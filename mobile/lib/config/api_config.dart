class ApiConfig {
  static String _baseUrl = 'http://10.0.2.2:3000/api';

  static String get baseUrl => _baseUrl;

  static void setBaseUrl(String url) {
    if (url.trim().isNotEmpty) {
      _baseUrl = url.trim().replaceAll(RegExp(r'\/+$'), '');
    }
  }

  // Endpoints
  static String get loginUrl => '$_baseUrl/auth/login';
  static String get projectsUrl => '$_baseUrl/projects';
  static String mobileCaptureUrl(String projectId) => '$_baseUrl/projects/$projectId/ai/mobile-capture';
  static String myCapturesUrl() => '$_baseUrl/ai/my-captures';

  // Limits
  static const int maxImageSizeBytes = 5 * 1024 * 1024; // 5 MB
  static const List<String> allowedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ];
}
