startWebServer() {
  const app = express();
  const configuredPort = Number(this.config.api?.port || process.env.PORT || 3000);
  const maxPortRetryAttempts = Number(process.env.PORT_RETRY_ATTEMPTS || 5);
  const host = process.env.WEB_HOST || '0.0.0.0';
  const corsOrigin = this.config.api?.cors?.origin || '*';

  // Parse JSON requests
  app.use(express.json());

  // CORS
  app.use((req, res, next) => {
    const allowedOrigins = Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin];
    const origin = req.headers.origin;

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin || '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  // Rate limiting
  const requestCounts = new Map();
  const windowMs = this.config.api?.rateLimit?.windowMs || 60000;
  const maxRequests = this.config.api?.rateLimit?.max || 100;

  app.use((req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, []);
    }

    const times = requestCounts
      .get(ip)
      .filter(t => t > windowStart);

    if (times.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests'
      });
    }

    times.push(now);
    requestCounts.set(ip, times);

    next();
  });

  // Health
  app.get('/health', (req, res) => {
    const dbStatus = this.db?.getStatus?.() || {
      isDegraded: 'unknown'
    };

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: dbStatus.connectionType !== 'none',
        degraded: dbStatus.isDegraded,
        type: dbStatus.connectionType
      }
    });
  });

  // Ready
  app.get('/ready', (req, res) => {
    const dbStatus = this.db?.getStatus?.() || {
      isDegraded: true,
      connectionType: 'none'
    };

    const isReady = this.isReady() && !dbStatus.isDegraded;

    const metrics = {
      guildCount: this.guilds?.cache?.size ?? 0,
      commandCount: this.commands?.size ?? 0,
      database: {
        mode: dbStatus.connectionType,
        degraded: dbStatus.isDegraded,
        degradedReason: dbStatus.degradedReason ?? null,
      },
      schemaVersion: EXPECTED_SCHEMA_VERSION,
      schemaLabel: EXPECTED_SCHEMA_LABEL,
    };

    if (isReady) {
      return res.status(200).json({
        ready: true,
        message: 'Bot is ready',
        metrics,
      });
    }

    return res.status(503).json({
      ready: false,
      reason: !this.isReady()
        ? 'Bot not Ready'
        : 'Database degraded',
      metrics,
    });
  });

  // Basic API test
  app.get('/', (req, res) => {
    res.status(200).json({
      message: 'TitanBot System Online',
      version: pkg.version,
      timestamp: new Date().toISOString()
    });
  });

  // =========================================================
  // FIVE M RADIO DISCORD ROLE CHECK
  // =========================================================
  app.post('/check-role', async (req, res) => {
    try {
      const apiSecret = process.env.CARRADIO_API_SECRET;

      // Authenticate FiveM
      if (
        !apiSecret ||
        req.headers.authorization !== `Bearer ${apiSecret}`
      ) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
      }

      const { discordId } = req.body || {};

      // Validate Discord ID
      if (!discordId || !/^\d{17,20}$/.test(String(discordId))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Discord ID'
        });
      }

      // Your Discord server
      const guildId = '1527433714257105127';

      // Your Car Radio role
      const requiredRoleId = '1550977989385125918';

      // Get guild
      const guild = await this.guilds.fetch(guildId);

      if (!guild) {
        return res.status(500).json({
          success: false,
          error: 'Discord guild not found'
        });
      }

      // Get Discord member
      const member = await guild.members
        .fetch(String(discordId))
        .catch(() => null);

      // User isn't in Discord
      if (!member) {
        return res.status(200).json({
          success: true,
          hasRole: false
        });
      }

      // Check role
      const hasRole = member.roles.cache.has(requiredRoleId);

      logger.info(
        `[CARRADIO] Role check: ${discordId} -> ${hasRole ? 'ALLOWED' : 'DENIED'}`
      );

      return res.status(200).json({
        success: true,
        hasRole
      });

    } catch (error) {
      logger.error(
        '[CARRADIO] Role check failed:',
        error
      );

      return res.status(500).json({
        success: false,
        error: 'Role check failed'
      });
    }
  });

  // Start server
  const startServer = (port, attempt = 0) => {
    let hasStartedListening = false;

    const server = app.listen(port, host, () => {
      hasStartedListening = true;
      this.webServer = server;

      startupLog(
        `✅ Web Server running on ${host}:${port}`
      );

      startupLog(
        `Health endpoint: http://${host}:${port}/health`
      );

      startupLog(
        `Ready endpoint: http://${host}:${port}/ready`
      );

      startupLog(
        `Car Radio role API: http://${host}:${port}/check-role`
      );
    });

    server.on('error', (error) => {
      const errorCode = error?.code || 'UNKNOWN_ERROR';
      const errorMessage =
        error?.message || 'Unknown server error';

      if (
        !hasStartedListening &&
        errorCode === 'EADDRINUSE' &&
        attempt < maxPortRetryAttempts
      ) {
        const nextPort = port + 1;

        startupLog(
          `Port ${port} is already in use. Trying port ${nextPort}...`
        );

        setTimeout(
          () => startServer(nextPort, attempt + 1),
          250
        );

        return;
      }

      if (
        hasStartedListening &&
        errorCode === 'EADDRINUSE'
      ) {
        logger.warn(
          `Web server reported a duplicate bind warning on ${host}:${port}, but the bot remains online.`
        );

        return;
      }

      logger.error(
        `❌ Web server error on port ${port} (${errorCode}): ${errorMessage}`
      );

      if (!hasStartedListening) {
        process.exit(1);
      }
    });
  };

  startServer(configuredPort, 0);
}
