import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';
import '../models/auth_user.dart';

class AuthService {
  static const String _tokenKey = 'arqnova_auth_token';
  static const String _userKey = 'arqnova_auth_user';

  AuthUser? _currentUser;
  AuthUser? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null && _currentUser!.token.isNotEmpty;

  Future<AuthUser> login(String email, String password) async {
    final cleanEmail = email.trim();
    if (cleanEmail.isEmpty || password.isEmpty) {
      throw Exception('Por favor ingresa tu correo y contraseña.');
    }

    final response = await http.post(
      Uri.parse(ApiConfig.loginUrl),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': cleanEmail,
        'password': password,
      }),
    ).timeout(
      const Duration(seconds: 15),
      onTimeout: () => throw Exception('Tiempo de espera agotado al conectar con el servidor.'),
    );

    final dynamic data = jsonDecode(response.body);

    if (response.statusCode != 200 && response.statusCode != 201) {
      final message = data is Map ? data['message'] : null;
      throw Exception(message?.toString() ?? 'Credenciales inválidas o error de autenticación.');
    }

    final token = data['accessToken'] as String? ?? '';
    if (token.isEmpty) {
      throw Exception('No se recibió el token de autenticación del servidor.');
    }

    final user = AuthUser.fromJson(data, token);
    _currentUser = user;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userKey, jsonEncode(user.toJson()));

    return user;
  }

  Future<AuthUser?> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    final userJson = prefs.getString(_userKey);

    if (token != null && token.isNotEmpty && userJson != null) {
      try {
        final map = jsonDecode(userJson) as Map<String, dynamic>;
        _currentUser = AuthUser(
          id: map['id'] as String? ?? '',
          name: map['name'] as String? ?? '',
          email: map['email'] as String? ?? '',
          role: map['role'] as String? ?? 'COLABORADOR',
          token: token,
        );
        return _currentUser;
      } catch (_) {
        await logout();
      }
    }
    return null;
  }

  Future<void> logout() async {
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }
}
