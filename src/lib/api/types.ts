export type Role = "admin" | "user";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
  created_at: string;
  last_login_at: string | null;
};

export type ProfileStatus = "running" | "paused" | "stopped" | "error";

export type ProxyType = "http" | "socks5" | "ssh";

export type Proxy = {
  id: string;
  label: string;
  type: ProxyType;
  host: string;
  port: number;
  username: string | null;
  country: string;
  latency_ms: number | null;
  detected_ip: string | null;
  last_tested_at: string | null;
  healthy: boolean;
  profiles_count: number;
};

export type Profile = {
  id: string;
  name: string;
  status: ProfileStatus;
  os: "Windows 11" | "macOS 14" | "Linux" | "Android 14";
  fingerprint: string;
  timezone: string;
  locale: string;
  /** true => uses the platform default server IP, false => uses proxy_id */
  use_default_ip: boolean;
  proxy_id: string | null;
  effective_ip: string;
  owner_id: string;
  owner_name: string;
  last_session_at: string | null;
  sessions_today: number;
  created_at: string;
};

export type ProfileInput = {
  name: string;
  os: Profile["os"];
  timezone: string;
  locale: string;
  use_default_ip: boolean;
  proxy_id: string | null;
};

export type BrowserLaunch = {
  profile: Profile;
  live_view_url: string;
  expires_at: string | null;
};

export type ProxyInput = {
  label: string;
  type: ProxyType;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  country: string;
};

export type ActivityEntry = {
  id: string;
  at: string;
  actor_name: string;
  action:
    | "profile.start"
    | "profile.stop"
    | "profile.create"
    | "profile.delete"
    | "profile.update"
    | "proxy.test"
    | "auth.login"
    | "auth.password"
    | "settings.update";
  target: string;
  detail: string;
  level: "info" | "warn" | "error";
};

export type StatsOverview = {
  profiles_total: number;
  profiles_running: number;
  profiles_paused: number;
  sessions_today: number;
  proxies_healthy: number;
  proxies_total: number;
  usage: { date: string; sessions: number; minutes: number }[];
};

export type PlatformSettings = {
  default_server_ip: string;
  default_timezone: string;
  default_locale: string;
  auto_start_on_create: boolean;
  max_concurrent_profiles: number;
  webrtc_protection: boolean;
};

export type AuthSession = {
  token: string;
  user: User;
};

export type CreatedUser = User & {
  /** Solo se entrega en la respuesta de alta; no vuelve a poder consultarse. */
  temporary_password: string;
};
