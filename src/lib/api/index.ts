import { mockApi } from "./mock";
import type {
  ActivityEntry,
  AuthSession,
  CreatedUser,
  PlatformSettings,
  Profile,
  ProfileInput,
  Proxy,
  ProxyInput,
  Role,
  StatsOverview,
  User,
} from "./types";

export * from "./types";

const CONFIGURED_BASE_URL = (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(
  /\/$/,
  "",
);
const BASE_URL = CONFIGURED_BASE_URL ?? "/api";

/** En desarrollo local sin URL explícita conservamos el simulador de Lovable. */
export const USING_MOCK_BACKEND = import.meta.env.DEV && !CONFIGURED_BASE_URL;

const TOKEN_KEY = "novashield.token";

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    if (typeof window !== "undefined") window.sessionStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(TOKEN_KEY);
  },
};

async function http<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : (rest.body ?? null),
  });

  if (response.status === 401) {
    tokenStore.clear();
    throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
  }
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string; message?: string };
      message = payload.detail ?? payload.message ?? message;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Contrato único de datos. En modo simulado usa `mockApi`; con
 * VITE_API_BASE_URL definida llama al backend Python (ver docs/api-contract.md).
 * `actor` solo lo consume el simulador para atribuir la actividad.
 */
export const api = {
  login: (email: string, password: string): Promise<AuthSession> =>
    USING_MOCK_BACKEND
      ? mockApi.login(email, password)
      : http<AuthSession>("/auth/login", { method: "POST", json: { email, password } }),

  me: (token: string): Promise<User> =>
    USING_MOCK_BACKEND ? mockApi.me(token) : http<User>("/auth/me"),

  changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
    USING_MOCK_BACKEND
      ? Promise.resolve()
      : http<void>("/auth/password", {
          method: "POST",
          json: { current_password: currentPassword, new_password: newPassword },
        }),

  stats: (): Promise<StatsOverview> =>
    USING_MOCK_BACKEND ? mockApi.stats() : http<StatsOverview>("/stats/overview"),

  listProfiles: (): Promise<Profile[]> =>
    USING_MOCK_BACKEND ? mockApi.listProfiles() : http<Profile[]>("/profiles"),

  createProfile: (input: ProfileInput, actor: User): Promise<Profile> =>
    USING_MOCK_BACKEND
      ? mockApi.createProfile(input, actor)
      : http<Profile>("/profiles", { method: "POST", json: input }),

  updateProfile: (id: string, input: ProfileInput, actor: User): Promise<Profile> =>
    USING_MOCK_BACKEND
      ? mockApi.updateProfile(id, input, actor)
      : http<Profile>(`/profiles/${id}`, { method: "PATCH", json: input }),

  setProfileState: (id: string, action: "start" | "stop", actor: User): Promise<Profile> =>
    USING_MOCK_BACKEND
      ? mockApi.setProfileState(id, action, actor)
      : http<Profile>(`/profiles/${id}/${action}`, { method: "POST" }),

  deleteProfile: (id: string, actor: User): Promise<void> =>
    USING_MOCK_BACKEND
      ? mockApi.deleteProfile(id, actor)
      : http<void>(`/profiles/${id}`, { method: "DELETE" }),

  listProxies: (): Promise<Proxy[]> =>
    USING_MOCK_BACKEND ? mockApi.listProxies() : http<Proxy[]>("/proxies"),

  createProxy: (input: ProxyInput): Promise<Proxy> =>
    USING_MOCK_BACKEND
      ? mockApi.createProxy(input)
      : http<Proxy>("/proxies", { method: "POST", json: input }),

  deleteProxy: (id: string): Promise<void> =>
    USING_MOCK_BACKEND
      ? mockApi.deleteProxy(id)
      : http<void>(`/proxies/${id}`, { method: "DELETE" }),

  testProxy: (id: string, actor: User): Promise<Proxy> =>
    USING_MOCK_BACKEND
      ? mockApi.testProxy(id, actor)
      : http<Proxy>(`/proxies/${id}/test`, { method: "POST" }),

  listActivity: (): Promise<ActivityEntry[]> =>
    USING_MOCK_BACKEND ? mockApi.listActivity() : http<ActivityEntry[]>("/activity"),

  listUsers: (): Promise<User[]> =>
    USING_MOCK_BACKEND ? mockApi.listUsers() : http<User[]>("/users"),

  createUser: (input: { email: string; name: string; role: Role }): Promise<CreatedUser> =>
    USING_MOCK_BACKEND
      ? mockApi.createUser(input).then((user) => ({ ...user, temporary_password: "user123" }))
      : http<CreatedUser>("/users", { method: "POST", json: input }),

  updateUser: (id: string, patch: { role?: Role; status?: User["status"] }): Promise<User> =>
    USING_MOCK_BACKEND
      ? mockApi.updateUser(id, patch)
      : http<User>(`/users/${id}`, { method: "PATCH", json: patch }),

  getSettings: (): Promise<PlatformSettings> =>
    USING_MOCK_BACKEND ? mockApi.getSettings() : http<PlatformSettings>("/settings"),

  updateSettings: (patch: PlatformSettings, actor: User): Promise<PlatformSettings> =>
    USING_MOCK_BACKEND
      ? mockApi.updateSettings(patch, actor)
      : http<PlatformSettings>("/settings", { method: "PUT", json: patch }),
};
