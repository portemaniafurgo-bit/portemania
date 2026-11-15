import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SecureStoreAdapter, SUPABASE_URL, supabase } from "./supabase";
import { unregisterPushToken } from "./push";
import { stopTracking } from "./tracking";
import { fetchMyDriverProfile } from "./driverProfile";

/**
 * Sesión y rol del usuario. Equivalente móvil de `src/lib/AuthContext.jsx` +
 * `src/lib/postLogin.js`: el rol vive en `profiles.role` y decide si la app
 * muestra la experiencia de cliente o la de conductor.
 *
 * Una sola app con dos caras, como Uber (decisión de la especificación §1).
 */
const AuthContext = createContext({
  session: null,
  user: null,
  role: null,
  // ¿Puede usar la cara de conductor? true para role "driver" y para un
  // admin/staff que además tiene perfil de conductor. ÚNICA comprobación que
  // debe usar la interfaz para decidir si enseña cosas de conductor.
  isDriver: false,
  // Cara de la app que se muestra ("client" | "driver"). El ROL no cambia: un
  // conductor puede pasarse a la cara de cliente para pedir un porte (como en
  // Uber) y volver. Para un cliente, mode es siempre "client".
  mode: null,
  setMode: async () => {},
  loading: true,
  signOut: async () => {},
  refreshRole: async () => null,
  // Reintenta leer la sesión guardada si el arranque se atascó.
  retrySession: async () => {},
});

// Supabase no se entera de que una app móvil pasa a segundo plano: sin esto, el
// refresco automático del token seguiría corriendo dormido (batería) y podría no
// reanudarse al volver. En web esto no hace falta; en RN sí.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

// Rol cacheado POR USUARIO y solo si el servidor lo confirmó. El caché antiguo
// (cached_role_v1) era global y guardaba "client" cuando la consulta fallaba:
// un conductor con un fallo de red quedaba atrapado como cliente también en
// los arranques siguientes (bug real, nov 2026). Se deja de leer y se borra.
const LEGACY_ROLE_CACHE_KEY = "cached_role_v1";
const roleCacheKey = userId => `cached_role_v2:${userId}`;
// Cara elegida por un conductor ("client" para pedir como cliente). Local al
// dispositivo: no toca profiles.role, que es cosa del negocio.
const MODE_KEY = "active_mode_v1";

// Admin y staff pueden ser además conductores (perfil de conductor con su
// email de login): para ellos se comprueba aparte y se cachea por usuario, solo
// con respuestas confirmadas. Sin esto, un admin que conduce caía siempre en la
// app de cliente (caso real en producción, nov 2026).
const STAFF_ROLES = new Set(["admin", "staff"]);
const driverFlagKey = userId => `cached_has_driver_profile_v1:${userId}`;

// Reintentos mientras no se sepa el rol: 1 s, 2 s, 4 s y luego cada 8 s.
const ROLE_RETRY_DELAYS = [1000, 2000, 4000];
const ROLE_RETRY_EVERY = 8000;

/**
 * Rol VERIFICADO del usuario, o null = "no se sabe". Nunca se adivina
 * "client": un error de Supabase, el timeout, una excepción o una respuesta sin
 * filas (con sesión siempre hay fila en profiles; cero filas significa que el
 * servidor no aceptó el token) son "no se sabe", y el que llama conserva el rol
 * que ya tenía. Solo un rol confirmado se guarda en el caché.
 */
async function fetchRole(userId) {
  if (!userId) return null;
  let timer = null;
  try {
    // Con red inestable esta consulta puede no responder nunca (fetch sin
    // timeout): a los 8 segundos se corta y se trata como "no se sabe".
    const controller = new AbortController();
    const query = supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .abortSignal(controller.signal)
      .maybeSingle();
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => {
        controller.abort();
        resolve({ timedOut: true });
      }, 8000);
    });
    const result = await Promise.race([query, timeout]);
    if (!result || result.timedOut || result.error || !result.data) return null;
    // Fila presente pero sin rol: es un cliente de verdad (la fila existe), no
    // un fallo; así lo trataba ya la app.
    const role = result.data.role || "client";
    AsyncStorage.setItem(roleCacheKey(userId), role).catch(() => {});
    return role;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Rol cacheado de ESTE usuario en el último arranque: la app abre AL INSTANTE
 *  con él y lo revalida en segundo plano. Solo contiene roles que el servidor
 *  confirmó, así que una revalidación fallida nunca lo empeora. */
async function getCachedRole(userId) {
  if (!userId) return null;
  try {
    const cached = await AsyncStorage.getItem(roleCacheKey(userId));
    if (cached) return cached;
    // Migración del caché antiguo: el código anterior solo escribía "driver"
    // tras una lectura confirmada (y siempre del usuario con sesión), así que
    // ese valor se conserva; "client" NO, porque podía venir de un fallo. Sin
    // esto, un conductor sin cobertura en el primer arranque tras actualizar
    // se quedaría esperando en vez de abrir como conductor.
    const legacy = await AsyncStorage.getItem(LEGACY_ROLE_CACHE_KEY);
    await AsyncStorage.removeItem(LEGACY_ROLE_CACHE_KEY);
    if (legacy === "driver") {
      await AsyncStorage.setItem(roleCacheKey(userId), "driver");
      return "driver";
    }
    return null;
  } catch {
    return null;
  }
}

/** Clave con la que supabase-js guarda la sesión en el almacenamiento seguro
 *  (la misma que calcula createClient si no se le da otra). */
function sessionStorageKey() {
  return (
    supabase.auth.storageKey ||
    `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`
  );
}

/**
 * ¿Tiene este usuario (admin/staff) perfil de conductor? true/false
 * confirmados por el servidor, o null = no se sabe (error, timeout). Solo lo
 * confirmado se guarda en el caché.
 */
async function fetchHasDriverProfile(user) {
  if (!user?.id) return null;
  let timer = null;
  try {
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => resolve(undefined), 8000);
    });
    // isStaff: las filas sin email que un admin creó para otros no cuentan.
    const profile = await Promise.race([fetchMyDriverProfile(user, { isStaff: true }), timeout]);
    if (profile === undefined) return null;
    const has = !!profile;
    AsyncStorage.setItem(driverFlagKey(user.id), has ? "1" : "0").catch(() => {});
    return has;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getCachedDriverFlag(userId) {
  try {
    const v = await AsyncStorage.getItem(driverFlagKey(userId));
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

/** Ninguna limpieza del cierre de sesión puede colgarlo: con una red que no
 *  responde, a los pocos segundos se sigue adelante. */
function withTimeout(promise, ms) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise(resolve => {
      timer = setTimeout(resolve, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  // null = aún leyendo la preferencia; sin esperarla, un conductor que dejó la
  // app en modo cliente parpadearía por las pantallas de conductor al abrir.
  const [facePref, setFacePref] = useState(null);
  // Sube cada vez que hay que releer el rol del MISMO usuario (inicio de
  // sesión repetido, datos de usuario cambiados, token renovado sin rol).
  const [roleCheck, setRoleCheck] = useState(0);
  // Usuario al que pertenece el rol en pantalla. Se lee fuera de React (el
  // callback de Supabase, respuestas que llegan tarde) para no aplicar nunca
  // el rol de una cuenta a otra.
  const userIdRef = useRef(null);
  const roleRef = useRef(null);
  const userId = session?.user?.id ?? null;
  // Solo para admin/staff: ¿tiene además perfil de conductor? null = no se
  // sabe todavía; driverCheckDone = ya se intentó al menos una vez.
  const [hasDriverProfile, setHasDriverProfile] = useState(null);
  const [driverCheckDone, setDriverCheckDone] = useState(false);
  const hasDriverRef = useRef(null);
  const sessionUserRef = useRef(null);
  // Lectura de la sesión guardada al arrancar: el efecto la deja aquí para
  // poder reintentarla desde la pantalla de espera. sessionGenRef descarta
  // respuestas viejas (p. ej. tras cerrar sesión a mitad).
  const readSessionRef = useRef(null);
  const sessionGenRef = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then(v => setFacePref(v || "driver"))
      .catch(() => setFacePref("driver"));
  }, []);

  /** Aplica un rol recién leído. null (no se sabe) NUNCA pisa uno conocido. */
  const applyRole = useCallback((uid, fresh) => {
    if (!fresh || userIdRef.current !== uid) return;
    roleRef.current = fresh;
    setRole(prev => fresh ?? prev);
  }, []);

  /** Sesión nueva: si cambia el usuario (o sale), el rol anterior deja de
   *  valer en el mismo instante, antes de cualquier espera. */
  const adoptSession = useCallback(next => {
    const nextId = next?.user?.id ?? null;
    if (nextId !== userIdRef.current) {
      userIdRef.current = nextId;
      roleRef.current = null;
      setRole(null);
      hasDriverRef.current = null;
      setHasDriverProfile(null);
      setDriverCheckDone(false);
    }
    sessionUserRef.current = next?.user ?? null;
    setSession(next);
  }, []);

  useEffect(() => {
    let active = true;
    let retryTimer = null;

    // getSession lee del almacenamiento local, pero si el token caducó lo
    // renueva por red y entonces puede no contestar nunca. A los 8 s NO se
    // supone "sin sesión" (echaría al usuario al login): se sigue en la
    // pantalla de espera, que a los 10 s ofrece reintentar o cerrar sesión, y
    // se vuelve a probar sola cada 8 s. Una excepción sí es "sin sesión":
    // sesión ilegible = empezar deslogueado. El rol lo resuelve el efecto de
    // abajo.
    const readSession = async () => {
      const gen = ++sessionGenRef.current;
      clearTimeout(retryTimer);
      let timer = null;
      let result;
      try {
        result = await Promise.race([
          supabase.auth.getSession().then(({ data }) => ({ session: data.session })),
          new Promise(resolve => {
            timer = setTimeout(() => resolve({ timedOut: true }), 8000);
          }),
        ]);
      } catch {
        result = { session: null };
      } finally {
        clearTimeout(timer);
      }
      if (!active || gen !== sessionGenRef.current) return;
      if (result.timedOut) {
        retryTimer = setTimeout(readSession, 8000);
        return;
      }
      adoptSession(result.session);
      // Sin sesión, el caché antiguo de rol ya no es de nadie.
      if (!result.session) AsyncStorage.removeItem(LEGACY_ROLE_CACHE_KEY).catch(() => {});
      setLoading(false);
    };
    readSessionRef.current = readSession;
    readSession();

    // ⚠️ Sin awaits aquí dentro: Supabase espera a cada callback antes de
    // seguir con sus eventos, y una consulta lenta (o una que pida el token
    // mientras se está renovando) lo bloqueaba. Solo se apunta la sesión; el
    // rol se lee fuera, en el efecto de abajo.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      const nextId = next?.user?.id ?? null;
      const sameUser = nextId === userIdRef.current;
      // La sesión ya se conoce: una lectura de arranque atascada sobra.
      sessionGenRef.current += 1;
      clearTimeout(retryTimer);
      adoptSession(next);
      setLoading(false);
      if (!nextId || !sameUser) return; // usuario nuevo: el efecto relee solo
      if (event === "INITIAL_SESSION") return; // el arranque ya lo está leyendo
      // Renovar el token no cambia el rol: no se relee si ya se conoce. Si no
      // se conoce, un token nuevo es justo el momento de reintentar.
      if (event === "TOKEN_REFRESHED" && roleRef.current) return;
      setRoleCheck(n => n + 1);
    });

    return () => {
      active = false;
      clearTimeout(retryTimer);
      readSessionRef.current = null;
      sub.subscription.unsubscribe();
    };
  }, [adoptSession]);

  const retrySession = useCallback(async () => {
    await readSessionRef.current?.();
  }, []);

  // Resolución del rol del usuario actual: primero el caché de ESTE usuario
  // (arranque instantáneo), después el servidor. Si el servidor no contesta y
  // no hay rol conocido, se reintenta con espera creciente y al volver la app
  // a primer plano; mientras tanto el guardia NO manda a nadie a cliente.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let timer = null;
    let attempt = 0;
    let inFlight = false;

    const schedule = () => {
      const delay = attempt < ROLE_RETRY_DELAYS.length ? ROLE_RETRY_DELAYS[attempt] : ROLE_RETRY_EVERY;
      attempt += 1;
      clearTimeout(timer);
      timer = setTimeout(run, delay);
    };

    async function run() {
      if (cancelled || inFlight) return;
      inFlight = true;
      clearTimeout(timer);
      const fresh = await fetchRole(userId);
      inFlight = false;
      if (cancelled) return;
      applyRole(userId, fresh);
      if (!fresh && !roleRef.current) schedule();
    }

    (async () => {
      if (!roleRef.current) {
        const cached = await getCachedRole(userId);
        if (cancelled) return;
        if (cached && !roleRef.current) applyRole(userId, cached);
      }
      run();
    })();

    const appStateSub = AppState.addEventListener("change", state => {
      if (state !== "active" || cancelled || roleRef.current) return;
      attempt = 0;
      run();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      appStateSub.remove();
    };
  }, [userId, roleCheck, applyRole]);

  // Admin/staff: ¿también conductor? Se decide una vez conocido el rol: caché
  // de ESTE usuario primero, luego el servidor. Lo que no se sabe no pisa lo
  // que se sabía; si falla, se reintenta al volver la app a primer plano.
  const isStaffRole = STAFF_ROLES.has(role);
  useEffect(() => {
    if (!userId || !isStaffRole) return;
    let cancelled = false;
    let inFlight = false;

    const apply = has => {
      if (cancelled || has === null || userIdRef.current !== userId) return;
      hasDriverRef.current = has;
      setHasDriverProfile(prev => has ?? prev);
    };

    async function check() {
      if (cancelled || inFlight) return;
      inFlight = true;
      const fresh = await fetchHasDriverProfile(sessionUserRef.current);
      inFlight = false;
      if (cancelled || userIdRef.current !== userId) return;
      apply(fresh);
      setDriverCheckDone(true);
    }

    (async () => {
      if (hasDriverRef.current === null) {
        const cached = await getCachedDriverFlag(userId);
        if (cancelled) return;
        if (hasDriverRef.current === null) apply(cached);
      }
      check();
    })();

    const appStateSub = AppState.addEventListener("change", state => {
      if (state === "active" && hasDriverRef.current === null) check();
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, [userId, isStaffRole, roleCheck]);

  const signOut = useCallback(async () => {
    // El rol cacheado es de ESTA cuenta: el siguiente que entre no lo hereda.
    const uid = userIdRef.current;
    if (uid) {
      AsyncStorage.removeItem(roleCacheKey(uid)).catch(() => {});
      AsyncStorage.removeItem(driverFlagKey(uid)).catch(() => {});
    }
    // Antes de cerrar sesión: si no, este móvil seguiría recibiendo los avisos
    // del usuario que se acaba de ir. Pero ninguna de estas limpiezas puede
    // IMPEDIR salir: cerrar sesión tiene que funcionar hasta sin red (por eso
    // cada paso tiene un tope de tiempo).
    try {
      await withTimeout(unregisterPushToken(), 4000);
    } catch {}
    try {
      await withTimeout(stopTracking(), 4000);
    } catch {}
    let signedOut = false;
    try {
      const result = await withTimeout(supabase.auth.signOut(), 5000);
      signedOut = !!result && !result.error;
    } catch {}
    // Si Supabase no pudo cerrar (error o sin respuesta), se borra a mano la
    // sesión guardada en el almacenamiento seguro: si no, al volver a abrir la
    // app el usuario seguiría dentro.
    if (!signedOut) {
      try {
        supabase.auth.stopAutoRefresh();
      } catch {}
      const key = sessionStorageKey();
      await SecureStoreAdapter.removeItem(key);
      await SecureStoreAdapter.removeItem(`${key}-code-verifier`);
    }
    // Una lectura de arranque aún pendiente ya no puede devolver la sesión.
    sessionGenRef.current += 1;
    userIdRef.current = null;
    roleRef.current = null;
    hasDriverRef.current = null;
    sessionUserRef.current = null;
    setSession(null);
    setRole(null);
    setHasDriverProfile(null);
    setDriverCheckDone(false);
    setLoading(false);
    // La cara elegida es de ESTA cuenta: el siguiente que entre en el móvil
    // empieza en la suya por defecto.
    setFacePref("driver");
    AsyncStorage.removeItem(MODE_KEY).catch(() => {});
  }, []);

  /** Relee el rol ya. Devuelve el rol verificado o null si no se pudo saber
   *  (en ese caso se conserva el que hubiera). */
  const refreshRole = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return null;
    const fresh = await fetchRole(uid);
    applyRole(uid, fresh);
    return fresh;
  }, [applyRole]);

  const setMode = useCallback(async m => {
    setFacePref(m);
    AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
  }, []);

  // Conductor = role "driver", o admin/staff con perfil de conductor.
  const isDriver = role === "driver" || (isStaffRole && hasDriverProfile === true);
  // Admin/staff sin respuesta todavía (primera vez, sin caché): se espera a
  // la primera comprobación para no hacerle pasar por cliente. Si esa falla,
  // se queda como hasta ahora (cliente) y cambia solo cuando se confirme.
  const waitingDriverCheck = isStaffRole && hasDriverProfile === null && !driverCheckDone;

  // La cara efectiva: solo un conductor puede elegirla; para el resto es
  // siempre cliente. null mientras falte el rol o la preferencia guardada.
  const mode = !role || waitingDriverCheck
    ? null
    : !isDriver
      ? "client"
      : facePref === null
        ? null
        : facePref === "client"
          ? "client"
          : "driver";

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        isDriver,
        mode,
        setMode,
        loading,
        signOut,
        refreshRole,
        retrySession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/** Grupo de rutas que corresponde a cada usuario. Recibe el `isDriver` del
 *  contexto (no el rol a secas: un admin con perfil de conductor también
 *  conduce). El admin sin perfil de conductor sigue siendo cliente en la app
 *  y administra desde el panel web. */
export function homeForRole(isDriver) {
  return isDriver ? "/(conductor)/ofertas" : "/(cliente)/pedir";
}
