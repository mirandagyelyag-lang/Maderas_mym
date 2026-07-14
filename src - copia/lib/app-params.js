const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
    if (isNode) {
        return defaultValue;
    }
    const storageKey = `base44_${toSnakeCase(paramName)}`;
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get(paramName);
    if (removeFromUrl) {
        urlParams.delete(paramName);
        const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
            }${window.location.hash}`;
        window.history.replaceState({}, document.title, newUrl);
    }
    if (searchParam) {
        storage.setItem(storageKey, searchParam);
        return searchParam;
    }
    if (defaultValue) {
        storage.setItem(storageKey, defaultValue);
        return defaultValue;
    }
    const storedValue = storage.getItem(storageKey);
    if (storedValue) {
        return storedValue;
    }
    return null;
}

const getAppParams = () => {
    if (getAppParamValue("clear_access_token") === 'true') {
        storage.removeItem('base44_access_token');
        storage.removeItem('token');
    }

    // 🛡️ RECOLECTOR DE EMERGENCIA: Si Vite falla, sacamos el ID del link de tu app o de la memoria vieja
    const urlParams = new URLSearchParams(window.location.search);
    const backupId = urlParams.get("app_id") || storage.getItem("base44_app_id") || "maderas"; 

    return {
        appId: getAppParamValue("app_id") || import.meta.env.VITE_BASE44_APP_ID || backupId,
        token: getAppParamValue("access_token", { removeFromUrl: true }) || storage.getItem("base44_access_token"),
        fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
        functionsVersion: getAppParamValue("functions_version") || import.meta.env.VITE_BASE44_FUNCTIONS_VERSION || "v1",
        appBaseUrl: getAppParamValue("app_base_url") || import.meta.env.VITE_BASE44_APP_BASE_URL || "https://api.base44.com",
    }
}

export const appParams = {
    ...getAppParams()
}