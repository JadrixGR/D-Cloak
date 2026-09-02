import type {
  ActivityEntry,
  AuthSession,
  PlatformSettings,
  Profile,
  ProfileInput,
  Proxy,
  ProxyInput,
  Role,
  StatsOverview,
  User,
} from "./types";

const delay = (ms = 260) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);
const iso = (offsetMinutes: number) => new Date(Date.now() - offsetMinutes * 60_000).toISOString();

const users: User[] = [
  {
    id: "u_admin",
    email: "admin@antidetect.io",
    name: "Nova Admin",
    role: "admin",
    status: "active",
    created_at: iso(60 * 24 * 120),
    last_login_at: iso(35),
  },
  {
    id: "u_std",
    email: "user@antidetect.io",
    name: "Operador Uno",
    role: "user",
    status: "active",
    created_at: iso(60 * 24 * 40),
    last_login_at: iso(190),
  },
  {
    id: "u_std2",
    email: "sofia@antidetect.io",
    name: "Sofía Vega",
    role: "user",
    status: "suspended",
    created_at: iso(60 * 24 * 12),
    last_login_at: iso(60 * 24 * 5),
  },
];

const passwords: Record<string, string> = {
  "admin@antidetect.io": "admin123",
  "user@antidetect.io": "user123",
  "sofia@antidetect.io": "user123",
};

let settings: PlatformSettings = {
  default_server_ip: "203.0.113.24",
  default_timezone: "America/Lima",
  default_locale: "es-PE",
  auto_start_on_create: false,
  max_concurrent_profiles: 12,
  webrtc_protection: true,
};

const proxies: Proxy[] = [
  {
    id: "px_1",
    label: "Residencial US-East",
    type: "socks5",
    host: "us-east.proxyline.net",
    port: 9050,
    username: "nova_us",
    country: "US",
    latency_ms: 84,
    detected_ip: "198.51.100.42",
    last_tested_at: iso(22),
    healthy: true,
    profiles_count: 2,
  },
  {
    id: "px_2",
    label: "Móvil BR-SP",
    type: "http",
    host: "sp.mobilenet.io",
    port: 8080,
    username: "brmob",
    country: "BR",
    latency_ms: 152,
    detected_ip: "177.12.44.9",
    last_tested_at: iso(95),
    healthy: true,
    profiles_count: 1,
  },
  {
    id: "px_3",
    label: "Datacenter DE-FRA",
    type: "http",
    host: "fra.dcpool.net",
    port: 3128,
    username: null,
    country: "DE",
    latency_ms: 412,
    detected_ip: null,
    last_tested_at: iso(60 * 26),
    healthy: false,
    profiles_count: 0,
  },
  {
    id: "px_4",
    label: "SSH Túnel PE-LIM",
    type: "ssh",
    host: "lima.tunnel.dev",
    port: 22,
    username: "root",
    country: "PE",
    latency_ms: 38,
    detected_ip: "190.234.11.77",
    last_tested_at: iso(8),
    healthy: true,
    profiles_count: 1,
  },
];

const profiles: Profile[] = [
  {
    id: "pf_1",
    name: "Amazon Seller · Alpha",
    status: "running",
    os: "Windows 11",
    fingerprint: "Chromium 128 · Canvas noise",
    timezone: "America/New_York",
    locale: "en-US",
    use_default_ip: false,
    proxy_id: "px_1",
    effective_ip: "198.51.100.42",
    owner_id: "u_admin",
    owner_name: "Nova Admin",
    last_session_at: iso(12),
    sessions_today: 5,
    created_at: iso(60 * 24 * 30),
  },
  {
    id: "pf_2",
    name: "Ads Manager · Bravo",
    status: "paused",
    os: "macOS 14",
    fingerprint: "Chromium 127 · WebGL spoof",
    timezone: "America/Sao_Paulo",
    locale: "pt-BR",
    use_default_ip: false,
    proxy_id: "px_2",
    effective_ip: "177.12.44.9",
    owner_id: "u_std",
    owner_name: "Operador Uno",
    last_session_at: iso(180),
    sessions_today: 2,
    created_at: iso(60 * 24 * 18),
  },
  {
    id: "pf_3",
    name: "Scraper Retail · Charlie",
    status: "running",
    os: "Linux",
    fingerprint: "Chromium 128 · Headless mask",
    timezone: "America/Lima",
    locale: "es-PE",
    use_default_ip: true,
    proxy_id: null,
    effective_ip: settings.default_server_ip,
    owner_id: "u_std",
    owner_name: "Operador Uno",
    last_session_at: iso(3),
    sessions_today: 9,
    created_at: iso(60 * 24 * 9),
  },
  {
    id: "pf_4",
    name: "Social Warmup · Delta",
    status: "stopped",
    os: "Android 14",
    fingerprint: "Chromium 126 · Touch profile",
    timezone: "Europe/Berlin",
    locale: "de-DE",
    use_default_ip: true,
    proxy_id: null,
    effective_ip: settings.default_server_ip,
    owner_id: "u_std2",
    owner_name: "Sofía Vega",
    last_session_at: iso(60 * 30),
    sessions_today: 0,
    created_at: iso(60 * 24 * 5),
  },
  {
    id: "pf_5",
    name: "Checkout QA · Echo",
    status: "error",
    os: "Windows 11",
    fingerprint: "Chromium 128 · Audio noise",
    timezone: "America/Lima",
    locale: "es-PE",
    use_default_ip: false,
    proxy_id: "px_4",
    effective_ip: "190.234.11.77",
    owner_id: "u_admin",
    owner_name: "Nova Admin",
    last_session_at: iso(52),
    sessions_today: 1,
    created_at: iso(60 * 24 * 2),
  },
];

const activity: ActivityEntry[] = [
  {
    id: "ac_1",
    at: iso(3),
    actor_name: "Operador Uno",
    action: "profile.start",
    target: "Scraper Retail · Charlie",
    detail: "Sesión iniciada con IP del servidor por defecto",
    level: "info",
  },
  {
    id: "ac_2",
    at: iso(8),
    actor_name: "Nova Admin",
    action: "proxy.test",
    target: "SSH Túnel PE-LIM",
    detail: "38 ms · 190.234.11.77",
    level: "info",
  },
  {
    id: "ac_3",
    at: iso(52),
    actor_name: "Nova Admin",
    action: "profile.start",
    target: "Checkout QA · Echo",
    detail: "Fallo de handshake con el proxy asignado",
    level: "error",
  },
  {
    id: "ac_4",
    at: iso(95),
    actor_name: "Operador Uno",
    action: "profile.stop",
    target: "Ads Manager · Bravo",
    detail: "Perfil pausado manualmente",
    level: "warn",
  },
  {
    id: "ac_5",
    at: iso(190),
    actor_name: "Operador Uno",
    action: "auth.login",
    target: "user@antidetect.io",
    detail: "Inicio de sesión correcto",
    level: "info",
  },
];

function log(entry: Omit<ActivityEntry, "id" | "at">) {
  activity.unshift({ id: `ac_${uid()}`, at: new Date().toISOString(), ...entry });
}

function resolveIp(useDefault: boolean, proxyId: string | null) {
  if (useDefault) return settings.default_server_ip;
  const px = proxies.find((p) => p.id === proxyId);
  return px?.detected_ip ?? "sin resolver";
}

function refreshProxyCounts() {
  for (const px of proxies) {
    px.profiles_count = profiles.filter((p) => p.proxy_id === px.id).length;
  }
}

export const mockApi = {
  async login(email: string, password: string): Promise<AuthSession> {
    await delay(420);
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || passwords[user.email] !== password) {
      throw new Error("Credenciales inválidas. Verifica tu correo y contraseña.");
    }
    if (user.status === "suspended") {
      throw new Error("Esta cuenta está suspendida. Contacta a un administrador.");
    }
    user.last_login_at = new Date().toISOString();
    log({
      actor_name: user.name,
      action: "auth.login",
      target: user.email,
      detail: "Inicio de sesión correcto",
      level: "info",
    });
    return { token: `mock.${user.id}.${uid()}`, user: { ...user } };
  },

  async me(token: string): Promise<User> {
    await delay(120);
    const id = token.split(".")[1];
    const user = users.find((u) => u.id === id);
    if (!user) throw new Error("Sesión expirada");
    return { ...user };
  },

  async stats(): Promise<StatsOverview> {
    await delay();
    const usage = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86_400_000);
      const sessions = [14, 22, 9, 31, 27, 18, 24][i] ?? 10;
      return {
        date: d.toISOString().slice(0, 10),
        sessions,
        minutes: sessions * (18 + (i % 3) * 7),
      };
    });
    return {
      profiles_total: profiles.length,
      profiles_running: profiles.filter((p) => p.status === "running").length,
      profiles_paused: profiles.filter((p) => p.status === "paused").length,
      sessions_today: profiles.reduce((a, p) => a + p.sessions_today, 0),
      proxies_healthy: proxies.filter((p) => p.healthy).length,
      proxies_total: proxies.length,
      usage,
    };
  },

  async listProfiles(): Promise<Profile[]> {
    await delay();
    return profiles.map((p) => ({ ...p }));
  },

  async createProfile(input: ProfileInput, actor: User): Promise<Profile> {
    await delay(320);
    const profile: Profile = {
      id: `pf_${uid()}`,
      name: input.name,
      status: settings.auto_start_on_create ? "running" : "stopped",
      os: input.os,
      fingerprint: "Chromium 128 · Perfil generado",
      timezone: input.timezone,
      locale: input.locale,
      use_default_ip: input.use_default_ip,
      proxy_id: input.use_default_ip ? null : input.proxy_id,
      effective_ip: resolveIp(input.use_default_ip, input.proxy_id),
      owner_id: actor.id,
      owner_name: actor.name,
      last_session_at: null,
      sessions_today: 0,
      created_at: new Date().toISOString(),
    };
    profiles.unshift(profile);
    refreshProxyCounts();
    log({
      actor_name: actor.name,
      action: "profile.create",
      target: profile.name,
      detail: profile.use_default_ip
        ? `IP del servidor por defecto (${settings.default_server_ip})`
        : `Proxy individual asignado`,
      level: "info",
    });
    return { ...profile };
  },

  async updateProfile(id: string, input: ProfileInput, actor: User): Promise<Profile> {
    await delay(280);
    const profile = profiles.find((p) => p.id === id);
    if (!profile) throw new Error("Perfil no encontrado");
    Object.assign(profile, {
      ...input,
      proxy_id: input.use_default_ip ? null : input.proxy_id,
      effective_ip: resolveIp(input.use_default_ip, input.proxy_id),
    });
    refreshProxyCounts();
    log({
      actor_name: actor.name,
      action: "profile.update",
      target: profile.name,
      detail: "Configuración de red y huella actualizada",
      level: "info",
    });
    return { ...profile };
  },

  async setProfileState(id: string, action: "start" | "stop", actor: User): Promise<Profile> {
    await delay(520);
    const profile = profiles.find((p) => p.id === id);
    if (!profile) throw new Error("Perfil no encontrado");
    if (action === "start") {
      profile.status = "running";
      profile.last_session_at = new Date().toISOString();
      profile.sessions_today += 1;
    } else {
      profile.status = "paused";
    }
    log({
      actor_name: actor.name,
      action: action === "start" ? "profile.start" : "profile.stop",
      target: profile.name,
      detail:
        action === "start" ? `Instancia levantada en ${profile.effective_ip}` : "Instancia pausada",
      level: action === "start" ? "info" : "warn",
    });
    return { ...profile };
  },

  async deleteProfile(id: string, actor: User): Promise<void> {
    await delay(300);
    const idx = profiles.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("Perfil no encontrado");
    const [removed] = profiles.splice(idx, 1);
    refreshProxyCounts();
    log({
      actor_name: actor.name,
      action: "profile.delete",
      target: removed!.name,
      detail: "Instancia y datos de sesión eliminados",
      level: "warn",
    });
  },

  async listProxies(): Promise<Proxy[]> {
    await delay();
    refreshProxyCounts();
    return proxies.map((p) => ({ ...p }));
  },

  async createProxy(input: ProxyInput): Promise<Proxy> {
    await delay(300);
    const proxy: Proxy = {
      id: `px_${uid()}`,
      label: input.label,
      type: input.type,
      host: input.host,
      port: input.port,
      username: input.username,
      country: input.country.toUpperCase(),
      latency_ms: null,
      detected_ip: null,
      last_tested_at: null,
      healthy: false,
      profiles_count: 0,
    };
    proxies.push(proxy);
    return { ...proxy };
  },

  async deleteProxy(id: string): Promise<void> {
    await delay(240);
    const idx = proxies.findIndex((p) => p.id === id);
    if (idx >= 0) proxies.splice(idx, 1);
  },

  async testProxy(id: string, actor: User): Promise<Proxy> {
    await delay(900);
    const proxy = proxies.find((p) => p.id === id);
    if (!proxy) throw new Error("Proxy no encontrado");
    const ok = Math.random() > 0.2;
    proxy.latency_ms = ok ? 30 + Math.floor(Math.random() * 240) : null;
    proxy.detected_ip = ok
      ? `${45 + Math.floor(Math.random() * 180)}.${Math.floor(Math.random() * 255)}.${Math.floor(
          Math.random() * 255,
        )}.${1 + Math.floor(Math.random() * 253)}`
      : null;
    proxy.healthy = ok;
    proxy.last_tested_at = new Date().toISOString();
    log({
      actor_name: actor.name,
      action: "proxy.test",
      target: proxy.label,
      detail: ok ? `${proxy.latency_ms} ms · ${proxy.detected_ip}` : "Sin respuesta del nodo",
      level: ok ? "info" : "error",
    });
    return { ...proxy };
  },

  async listActivity(): Promise<ActivityEntry[]> {
    await delay();
    return activity.map((a) => ({ ...a }));
  },

  async listUsers(): Promise<User[]> {
    await delay();
    return users.map((u) => ({ ...u }));
  },

  async createUser(input: { email: string; name: string; role: Role }): Promise<User> {
    await delay(300);
    if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("Ya existe un usuario con ese correo.");
    }
    const user: User = {
      id: `u_${uid()}`,
      email: input.email,
      name: input.name,
      role: input.role,
      status: "active",
      created_at: new Date().toISOString(),
      last_login_at: null,
    };
    users.push(user);
    passwords[user.email] = "user123";
    return { ...user };
  },

  async updateUser(id: string, patch: { role?: Role; status?: User["status"] }): Promise<User> {
    await delay(240);
    const user = users.find((u) => u.id === id);
    if (!user) throw new Error("Usuario no encontrado");
    Object.assign(user, patch);
    return { ...user };
  },

  async getSettings(): Promise<PlatformSettings> {
    await delay();
    return { ...settings };
  },

  async updateSettings(patch: PlatformSettings, actor: User): Promise<PlatformSettings> {
    await delay(320);
    settings = { ...patch };
    for (const p of profiles) {
      if (p.use_default_ip) p.effective_ip = settings.default_server_ip;
    }
    log({
      actor_name: actor.name,
      action: "settings.update",
      target: "Ajustes globales",
      detail: `IP del servidor por defecto: ${settings.default_server_ip}`,
      level: "info",
    });
    return { ...settings };
  },
};
