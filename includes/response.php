<?php
// includes/response.php
// Standardized JSON response helpers adhering to Section 10 specification

function send_json(array $payload, int $statusCode = 200): void {
    if (!headers_sent()) {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function send_success(string $message = 'Success', $data = [], int $statusCode = 200): void {
    send_json([
        'success' => true,
        'message' => $message,
        'data'    => (object)$data
    ], $statusCode);
}

function send_error(string $message = 'An error occurred', $errors = [], int $statusCode = 400): void {
    $response = [
        'success' => false,
        'message' => $message,
        'errors'  => (object)$errors
    ];
    send_json($response, $statusCode);
}

function get_json_input(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

