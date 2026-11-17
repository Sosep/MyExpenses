package org.totschnig.webui

import android.app.Notification
import android.app.PendingIntent
import android.app.PendingIntent.FLAG_ONE_SHOT
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteConstraintException
import android.net.Uri
import android.os.IBinder
import androidx.annotation.PluralsRes
import androidx.annotation.StringRes
import androidx.core.app.ServiceCompat
import androidx.core.database.getLongOrNull
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import io.ktor.http.ContentType
import io.ktor.http.Cookie
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.gson.gson
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.authenticate
import io.ktor.server.cio.CIO
import io.ktor.server.engine.EmbeddedServer
import io.ktor.server.engine.connector
import io.ktor.server.engine.embeddedServer
import io.ktor.server.engine.sslConnector
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.compression.Compression
import io.ktor.server.plugins.compression.gzip
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.defaultheaders.DefaultHeaders
import io.ktor.server.plugins.origin
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.request.path
import io.ktor.server.request.receive
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondBytes
import io.ktor.server.response.respondRedirect
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.routing
import io.ktor.utils.io.jvm.javaio.toByteReadChannel
import java.io.IOException
import java.lang.ref.WeakReference
import java.net.ServerSocket
import java.security.Security
import java.time.LocalDate
import java.time.LocalTime
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.totschnig.myexpenses.MyApplication
import org.totschnig.myexpenses.R
import org.totschnig.myexpenses.db2.Repository
import org.totschnig.myexpenses.db2.createTransaction
import org.totschnig.myexpenses.db2.getCurrencyUnitForAccount
import org.totschnig.myexpenses.db2.loadTransactions
import org.totschnig.myexpenses.db2.observePayeeMap
import org.totschnig.myexpenses.db2.observeTagMap
import org.totschnig.myexpenses.db2.updateTransaction
import org.totschnig.myexpenses.di.LocalDateAdapter
import org.totschnig.myexpenses.di.LocalTimeAdapter
import org.totschnig.myexpenses.feature.IWebInputService
import org.totschnig.myexpenses.feature.IWebInputService.Companion.log
import org.totschnig.myexpenses.feature.RESTART_ACTION
import org.totschnig.myexpenses.feature.START_ACTION
import org.totschnig.myexpenses.feature.ServerStateObserver
import org.totschnig.myexpenses.feature.WebUiBinder
import org.totschnig.myexpenses.model.ContribFeature
import org.totschnig.myexpenses.model.CurrencyContext
import org.totschnig.myexpenses.model.generateUuid
import org.totschnig.myexpenses.preference.PrefHandler
import org.totschnig.myexpenses.preference.PrefKey
import org.totschnig.myexpenses.preference.isWebUiActive
import org.totschnig.myexpenses.preference.setWebUiActive
import org.totschnig.myexpenses.provider.KEY_ACCOUNT_TYPE_LIST
import org.totschnig.myexpenses.provider.KEY_CURRENCY
import org.totschnig.myexpenses.provider.KEY_IS_NUMBERED
import org.totschnig.myexpenses.provider.KEY_LABEL
import org.totschnig.myexpenses.provider.KEY_LEVEL
import org.totschnig.myexpenses.provider.KEY_PARENTID
import org.totschnig.myexpenses.provider.KEY_PAYEE_NAME
import org.totschnig.myexpenses.provider.KEY_ROWID
import org.totschnig.myexpenses.provider.KEY_SEALED
import org.totschnig.myexpenses.provider.KEY_TYPE
import org.totschnig.myexpenses.provider.TransactionProvider
import org.totschnig.myexpenses.provider.appendBooleanQueryParameter
import org.totschnig.myexpenses.provider.useAndMapToList
import org.totschnig.myexpenses.util.AppDirHelper
import org.totschnig.myexpenses.util.ICurrencyFormatter
import org.totschnig.myexpenses.util.NotificationBuilderWrapper
import org.totschnig.myexpenses.util.NotificationBuilderWrapper.NOTIFICATION_WEB_UI
import org.totschnig.myexpenses.util.Utils
import org.totschnig.myexpenses.util.io.getActiveIpAddress
import org.totschnig.myexpenses.util.licence.LicenceHandler
import org.totschnig.webui.api.AndroidWebApiDataSource
import org.totschnig.webui.api.ApiError
import org.totschnig.webui.api.ApiException
import org.totschnig.webui.api.ApiRoutes
import org.totschnig.webui.api.FileDto
import org.totschnig.webui.api.SessionLoginDto

private const val STOP_CLICK_ACTION = "STOP_CLICK_ACTION"

// The shell is a Vite build. Its index.html boots the theme with an inline
// script, so scripts keep 'unsafe-inline' until that moves into the bundle;
// everything else is restricted to the app's own origin.
private const val APP_CSP =
    "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; " +
        "connect-src 'self'; manifest-src 'self'; worker-src 'self'; " +
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"

// JSON endpoints never need to load anything.
private const val API_CSP = "default-src 'none'; frame-ancestors 'none'"

class WebInputService : LifecycleService(), IWebInputService {

    @Inject
    lateinit var repository: Repository

    @Inject
    lateinit var gson: Gson

    @Inject
    lateinit var prefHandler: PrefHandler

    @Inject
    lateinit var dataStore: DataStore<Preferences>

    @Inject
    lateinit var licenceHandler: LicenceHandler

    @Inject
    lateinit var currencyContext: CurrencyContext

    @Inject
    lateinit var currencyFormatter: ICurrencyFormatter

    private lateinit var wrappedContext: Context

    private var serverStateObserver: ServerStateObserver? = null

    private var port: Int = 0

    class LocalBinder(private val webInputService: WeakReference<WebInputService>) : WebUiBinder() {
        override fun getService() = webInputService.get()
    }

    private lateinit var payeeMapFlow: StateFlow<Map<Long, String>>
    private lateinit var tagMapFlow: StateFlow<Map<Long, String>>

    private val startupMutex = Mutex()

    override fun onCreate() {
        super.onCreate()
        DaggerWebUiComponent.builder().appComponent((application as MyApplication).appComponent)
            .build().inject(this)
        wrappedContext = (application as MyApplication).wrapContext(this)
        // This shows the notification also if we bind to the service from WebUiViewModel.
        // unfortunately I am not aware of any means to distinguish between being created in the context
        // bindService or startService
        /*        val notification: Notification =
                    NotificationBuilderWrapper.defaultBigTextStyleBuilder(
                        this,
                        getString(R.string.title_webui),
                        "Starting ..."
                    ).build()
                startForeground(NOTIFICATION_WEB_UI, notification)*/

        payeeMapFlow = repository.observePayeeMap().stateIn(
            scope = lifecycleScope,
            started = SharingStarted.Eagerly,
            initialValue = emptyMap()
        )
        tagMapFlow = repository.observeTagMap().stateIn(
            scope = lifecycleScope,
            started = SharingStarted.Eagerly,
            initialValue = emptyMap()
        )

        lifecycleScope.launch {
            dataStore.isWebUiActive.collect { active ->
                if (!active) {
                    log("DataStore signaled stop. Shutting down.")
                    startupMutex.withLock {
                        stopServer()
                        stopSelf()
                    }
                }
            }
        }
    }

    override fun onBind(intent: Intent): IBinder {
        super.onBind(intent)
        return LocalBinder(WeakReference(this))
    }

    private var server: EmbeddedServer<*, *>? = null

    private var serverAddress: String? = null

    override fun registerObserver(serverStateObserver: ServerStateObserver) {
        this.serverStateObserver = serverStateObserver
        serverAddress?.let { serverStateObserver.postAddress(it) }
    }

    override fun unregisterObserver() {
        this.serverStateObserver = null
    }

    private fun getProtocol(useHttps: Boolean): String = if (useHttps) "https" else "http"

    private fun getAddress(useHttps: Boolean) = getActiveIpAddress(this)?.let {
        "${getProtocol(useHttps)}://$it:$port"
    } ?: "Listening on port $port"

    private fun readTextFromAssets(fileName: String) = assets.open(fileName).bufferedReader()
        .use {
            it.readText()
        }

    private fun readBytesFromAssets(fileName: String) = assets.open(fileName).use {
        it.readBytes()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        log("onStartCommand ${intent?.action}")

        val action = intent?.action ?: START_ACTION

        if (action == RESTART_ACTION && server == null) {
            return START_NOT_STICKY
        }

        if (action == START_ACTION || action == RESTART_ACTION) {
            licenceHandler.recordUsage(ContribFeature.WEB_UI)
            if (action == START_ACTION) {
                updateNotification()
            }

            lifecycleScope.launch(Dispatchers.Default + ktorServerExceptionHandler) {
                if (intent == null) {
                    if (!dataStore.isWebUiActive.first()) {
                        // Setting is actually false! Stop everything safely.
                        handleException(IllegalStateException("Web UI not active in settings"))
                        return@launch
                    }
                }
                startupMutex.withLock {
                    val useHttps = prefHandler.getBoolean(PrefKey.WEBUI_HTTPS, false)
                    if (server != null) {
                        if (action == START_ACTION) {
                            log("Web UI already running")
                            return@withLock
                        }
                        stopServer()
                    }
                    port = (9000..9050).firstOrNull { isAvailable(it) }
                        ?: throw IOException("No available port found in range 9000..9050")
                    if (useHttps) {
                        setupBouncyCastle()
                    }
                    server = embeddedServer(
                        if (useHttps) Netty else CIO,
                        configure = {
                            if (useHttps) {
                                log("use https generate certificate")
                                val keystore = generateCertificate(keyAlias = "myKey")
                                sslConnector(
                                    keyStore = keystore,
                                    keyAlias = "myKey",
                                    keyStorePassword = { charArrayOf() },
                                    privateKeyPassword = { charArrayOf() }
                                ) {
                                    port = this@WebInputService.port
                                }
                            } else {
                                connector {
                                    port = this@WebInputService.port
                                }
                            }
                        },
                        module = {
                            // The bundle is ~388 kB and the browser asks for gzip.
                            install(Compression) {
                                gzip { priority = 1.0 }
                            }
                            install(DefaultHeaders) {
                                header("X-Content-Type-Options", "nosniff")
                                header("Referrer-Policy", "no-referrer")
                                header("X-Frame-Options", "DENY")
                                header(
                                    "Permissions-Policy",
                                    "camera=(), microphone=(), geolocation=()"
                                )
                            }
                            install(
                                createApplicationPlugin("SecurityHeaders") {
                                    onCall { call ->
                                        // The API never serves resources; the shell needs its
                                        // own origin for the bundle, fonts, icons and worker.
                                        call.response.header(
                                            "Content-Security-Policy",
                                            if (call.request.path().startsWith("/api/")) {
                                                API_CSP
                                            } else {
                                                APP_CSP
                                            }
                                        )
                                    }
                                }
                            )
                            install(ContentNegotiation) {
                                gson {
                                    registerTypeAdapter(
                                        LocalDate::class.java,
                                        LocalDateAdapter
                                    )
                                    registerTypeAdapter(
                                        LocalTime::class.java,
                                        LocalTimeAdapter
                                    )
                                }
                            }
                            val passWord = prefHandler.getString(PrefKey.WEBUI_PASSWORD, "")
                                .takeIf { !it.isNullOrBlank() }
                            val sessions = SessionStore()
                            val loginThrottle = LoginThrottle()
                            passWord?.let {
                                install(Authentication) {
                                    session(sessions)
                                }
                            }

                            install(StatusPages) {
                                exception<BadRequestException> { call, _ ->
                                    call.respond(
                                        HttpStatusCode.BadRequest,
                                        ApiError("invalid_body", "Malformed request body")
                                    )
                                }
                                exception<SQLiteConstraintException> { call, cause ->
                                    IWebInputService.report(cause)
                                    if (!call.response.isCommitted) {
                                        call.respond(
                                            HttpStatusCode.UnprocessableEntity,
                                            ApiError(
                                                "constraint_violation",
                                                "The transaction violates a data rule"
                                            )
                                        )
                                    }
                                }
                                exception<ApiException> { call, cause ->
                                    call.respond(
                                        cause.status,
                                        ApiError(cause.code, cause.message, cause.fields)
                                    )
                                }
                                exception<Throwable> { call, cause ->
                                    IWebInputService.report(cause)
                                    if (!call.response.isCommitted) {
                                        call.respond(
                                            HttpStatusCode.InternalServerError,
                                            ApiError(
                                                "internal_error",
                                                "Internal server error"
                                            )
                                        )
                                    }
                                }
                            }

                            routing {
                                get("/") {
                                    call.respondRedirect("/app/")
                                }
                                get("/download") {
                                    call.respondRedirect("/app/?view=files")
                                }
                                get("/favicon.ico") {
                                    call.respondBytes(
                                        readBytesFromAssets("favicon.ico"),
                                        ContentType.Image.XIcon
                                    )
                                }
                                post("/api/v1/session") {
                                    val client = call.request.origin.remoteHost
                                    loginThrottle.retryAfterSeconds(client)?.let { wait ->
                                        call.response.header(
                                            HttpHeaders.RetryAfter,
                                            wait.toString()
                                        )
                                        throw ApiException(
                                            HttpStatusCode.TooManyRequests,
                                            "too_many_attempts",
                                            "Too many attempts, retry later"
                                        )
                                    }
                                    val body = call.receive<SessionLoginDto>()
                                    if (passWord != null && body.password != passWord) {
                                        loginThrottle.recordFailure(client)
                                        throw ApiException(
                                            HttpStatusCode.Unauthorized,
                                            "unauthorized",
                                            "Wrong password"
                                        )
                                    }
                                    loginThrottle.clear(client)
                                    val token = sessions.create()
                                    call.response.cookies.append(
                                        Cookie(
                                            name = SessionStore.COOKIE_NAME,
                                            value = token,
                                            maxAge = SessionStore.TTL.seconds.toInt(),
                                            path = "/",
                                            secure = useHttps,
                                            httpOnly = true,
                                            extensions = mapOf("SameSite" to "Strict")
                                        )
                                    )
                                    call.respond(HttpStatusCode.NoContent)
                                }
                                delete("/api/v1/session") {
                                    call.request.cookies[SessionStore.COOKIE_NAME]?.let(
                                        sessions::remove
                                    )
                                    call.clearSessionCookie(useHttps)
                                    call.respond(HttpStatusCode.NoContent)
                                }
                                serveWebApp()
                                val appVersion =
                                    this@WebInputService.packageManager.getPackageInfo(
                                        this@WebInputService.packageName,
                                        0
                                    ).versionName ?: ""
                                val api = ApiRoutes(
                                    AndroidWebApiDataSource(
                                        repository = repository,
                                        prefHandler = prefHandler,
                                        currencyContext = currencyContext,
                                        payeeMap = payeeMapFlow,
                                        tagMap = tagMapFlow,
                                        appVersion = appVersion
                                    )
                                )
                                if (passWord == null) {
                                    api.register(this)
                                    fileRoutes()
                                } else {
                                    authenticate("auth-session") {
                                        api.register(this)
                                        fileRoutes()
                                    }
                                }
                            }
                        }
                    ).also { server ->
                        log("starting server")
                        server.start(wait = false)

                        serverAddress = getAddress(useHttps)
                        updateNotification()
                    }
                }
            }
            return START_STICKY
        }
        if (action == STOP_CLICK_ACTION) {
            switchOff()
        }
        return START_NOT_STICKY
    }

    private val ktorServerExceptionHandler = CoroutineExceptionHandler { _, exception ->
        handleException(exception)
    }

    private fun handleException(e: Throwable) {
        IWebInputService.report(e)
        serverStateObserver?.postException(e)
        switchOff()
    }

    private fun switchOff() {
        lifecycleScope.launch {
            dataStore.setWebUiActive(false)
        }
    }

    private fun Route.fileRoutes() {
        get("/api/v1/files") {
            val files = AppDirHelper.getAppDirFiles(this@WebInputService).getOrThrow()
            call.respond(
                files.map { file ->
                    FileDto(
                        name = file.name,
                        size = file.size,
                        modified = file.lastModified,
                        link = "/api/v1/files/${Uri.encode(file.name)}"
                    )
                }
            )
        }
        get("/api/v1/files/{name}") {
            val name = call.parameters["name"] ?: ""
            if (name.isBlank() || name.contains('/')) {
                call.respond(HttpStatusCode.NotFound, "File not found")
                return@get
            }
            val appDir = AppDirHelper.getAppDir(this@WebInputService).getOrThrow()
            val file = appDir.findFile(name)?.uri?.let {
                AppDirHelper.ensureContentUri(it, this@WebInputService)
            }
            if (file == null) {
                call.respond(HttpStatusCode.NotFound, "File not found")
            } else {
                call.response.headers.append(
                    HttpHeaders.ContentDisposition,
                    "attachment; filename=\"${name.replace("\"", "")}\""
                )
                call.respond(contentResolver.openInputStream(file)!!.toByteReadChannel())
            }
        }
    }

    private fun Route.serveWebApp() {
        get("/app") { call.respondWebAppIndex() }
        get("/app/") { call.respondWebAppIndex() }
        get("/app/{path...}") {
            val path = call.parameters.getAll("path")?.joinToString("/") ?: ""
            if (path.isBlank()) {
                call.respondWebAppIndex()
                return@get
            }
            try {
                val bytes = assets.open("webapp/$path").use { it.readBytes() }
                call.response.headers.append(
                    HttpHeaders.CacheControl,
                    if (path.startsWith("assets/")) {
                        "public, max-age=31536000, immutable"
                    } else {
                        "no-cache"
                    }
                )
                call.respondBytes(bytes, contentTypeFor(path))
            } catch (_: IOException) {
                if (!path.contains('.')) {
                    call.respondWebAppIndex()
                } else {
                    call.respond(HttpStatusCode.NotFound, "Not found")
                }
            }
        }
    }

    private suspend fun ApplicationCall.respondWebAppIndex() {
        response.headers.append(HttpHeaders.CacheControl, "no-cache")
        respondText(readTextFromAssets("webapp/index.html"), ContentType.Text.Html)
    }

    private fun contentTypeFor(path: String): ContentType =
        when (path.substringAfterLast('.', "").lowercase(Locale.ROOT)) {
            "html" -> ContentType.Text.Html
            "js", "mjs" -> ContentType.Text.JavaScript
            "css" -> ContentType.Text.CSS
            "json" -> ContentType.Application.Json
            "webmanifest" -> ContentType("application", "manifest+json")
            "svg" -> ContentType("image", "svg+xml")
            "png" -> ContentType.Image.PNG
            "jpg", "jpeg" -> ContentType("image", "jpeg")
            "ico" -> ContentType.Image.XIcon
            "woff2" -> ContentType("font", "woff2")
            "woff" -> ContentType("font", "woff")
            "ttf" -> ContentType("font", "ttf")
            else -> ContentType.Application.OctetStream
        }

    private fun isAvailable(portNr: Int) = try {
        ServerSocket(portNr).close()
        true
    } catch (_: IOException) {
        false
    }

    override fun onDestroy() {
        stopServer()
        super.onDestroy()
    }

    private fun stopServer() = if (server != null) {
        server?.stop(0, 0)
        server = null
        serverAddress = null
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        serverStateObserver?.onStopped()
        true
    } else {
        false
    }

    private fun updateNotification() {
        val content = serverAddress ?: getString(R.string.service_starting)
        val notification: Notification =
            NotificationBuilderWrapper.defaultBigTextStyleBuilder(
                this@WebInputService,
                getString(R.string.title_webui),
                content
            ).apply {
                if (serverAddress != null) {
                    addAction(
                        0,
                        getString(R.string.stop),
                        //noinspection InlinedApi
                        PendingIntent.getService(
                            this@WebInputService,
                            0,
                            Intent(
                                this@WebInputService,
                                WebInputService::class.java
                            ).apply {
                                action = STOP_CLICK_ACTION
                            },
                            FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                        )
                    )
                }
            }
                .build()
        startForeground(NOTIFICATION_WEB_UI, notification)
        serverStateObserver?.postAddress(content)
        log("startForeground called")
    }

    companion object {

        private var bcInitialized = false

        fun setupBouncyCastle() {
            if (!bcInitialized) {
                log("init BouncyCastle start")
                Security.removeProvider("BC")
                Security.addProvider(BouncyCastleProvider())
                log("init BouncyCastle end")
                bcInitialized = true
            }
        }
    }
}
