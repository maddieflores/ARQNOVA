import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/project.dart';

class ProjectsService {
  Future<List<Project>> getProjects(String token) async {
    if (token.isEmpty) {
      throw Exception('Sesión expirada o no autenticada.');
    }

    final response = await http.get(
      Uri.parse(ApiConfig.projectsUrl),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    ).timeout(
      const Duration(seconds: 15),
      onTimeout: () => throw Exception('Tiempo de espera agotado al obtener proyectos.'),
    );

    if (response.statusCode == 401) {
      throw Exception('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
    }

    if (response.statusCode != 200) {
      final dynamic data = jsonDecode(response.body);
      final message = data is Map ? data['message'] : null;
      throw Exception(message?.toString() ?? 'Error al cargar los proyectos.');
    }

    final List<dynamic> list = jsonDecode(response.body) as List<dynamic>;
    return list.map((item) => Project.fromJson(item as Map<String, dynamic>)).toList();
  }
}
