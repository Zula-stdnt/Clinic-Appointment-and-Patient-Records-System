// assets/js/api.js
// Centralized Axios API client with CSRF injection and authentication error interception

// Fetch CSRF token from meta tag
export function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}

// Create custom Axios instance
const apiClient = axios.create({
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Request interceptor: attach CSRF token to state-changing operations
apiClient.interceptors.request.use((config) => {
    const method = config.method ? config.method.toUpperCase() : 'GET';
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const token = getCsrfToken();
        if (token) {
            config.headers['X-CSRF-Token'] = token;
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor: handle 401 unauthorized (redirect to login) and extract response shapes
apiClient.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            // Unauthenticated: redirect to login page immediately
            window.location.href = 'login.php';
            return Promise.reject(error);
        }
        return Promise.reject(error);
    }
);

export const api = {
    get: (url, params = {}) => apiClient.get(url, { params }),
    post: (url, data = {}) => apiClient.post(url, data),
    put: (url, data = {}) => apiClient.put(url, data),
    delete: (url, params = {}) => apiClient.delete(url, { params })
};

export default api;

