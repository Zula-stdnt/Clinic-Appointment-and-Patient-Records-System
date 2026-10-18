// assets/js/api.js
// Centralized Axios API client with CSRF injection, sessionStorage baseAPIUrl normalization, and authentication error interception
// ITE 387 Lessons applied: 03 APIs and Database Operations/javascript_working_with_apis (Centralized Axios request/response cycle, explicit HTTP status checks & status handling)
// & mysql_retrieve_specific_record (Global state persistence in sessionStorage.baseAPIUrl)

// Fetch CSRF token from meta tag
export function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}

// Retrieve or initialize baseAPIUrl in sessionStorage
export function getBaseApiUrl() {
    let base = sessionStorage.getItem('baseAPIUrl');
    if (!base && typeof window !== 'undefined' && window.location) {
        base = window.location.pathname.replace(/\/[^/]*$/, '') + '/api';
        sessionStorage.setItem('baseAPIUrl', base);
    }
    return base || 'api';
}

// Create custom Axios instance
const apiClient = axios.create({
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Request interceptor: normalize URL against baseAPIUrl and attach CSRF token to state-changing operations
apiClient.interceptors.request.use((config) => {
    const baseAPIUrl = getBaseApiUrl();
    if (config.url && !/^https?:\/\//i.test(config.url)) {
        let cleanUrl = config.url;
        if (cleanUrl.startsWith('/api/')) {
            cleanUrl = cleanUrl.substring(5);
        } else if (cleanUrl.startsWith('api/')) {
            cleanUrl = cleanUrl.substring(4);
        } else if (cleanUrl.startsWith('./api/')) {
            cleanUrl = cleanUrl.substring(6);
        }
        if (!config.url.startsWith(baseAPIUrl)) {
            const normalizedBase = baseAPIUrl.endsWith('/') ? baseAPIUrl : baseAPIUrl + '/';
            config.url = normalizedBase + cleanUrl.replace(/^\/+/, '');
        }
    }

    const method = config.method ? config.method.toUpperCase() : 'GET';
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const token = getCsrfToken();
        if (token) {
            if (config.headers && typeof config.headers.set === 'function') {
                config.headers.set('X-CSRF-Token', token);
            } else {
                config.headers['X-CSRF-Token'] = token;
            }
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor: handle 401 unauthorized (redirect to login) and explicit HTTP status code verification
apiClient.interceptors.response.use(
    (response) => {
        // ITE 387 Lesson: javascript_working_with_apis (Explicit status code check)
        if (response.status >= 200 && response.status < 300) {
            return response.data;
        }
        return Promise.reject(new Error(`Unexpected status code: ${response.status}`));
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            // Unauthenticated: redirect to login page immediately
            window.location.href = 'login.html';
            return Promise.reject(error);
        }
        return Promise.reject(error);
    }
);

export const api = {
    get: (url, params = {}, config = {}) => apiClient.get(url, { params, ...config }),
    post: (url, data = {}, config = {}) => apiClient.post(url, data, config),
    put: (url, data = {}, config = {}) => apiClient.put(url, data, config),
    delete: (url, params = {}, config = {}) => apiClient.delete(url, { params, ...config })
};

export default api;

