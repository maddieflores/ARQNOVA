import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../models/capture_history_item.dart';
import '../models/proposal_summary.dart';

class CaptureService {
  Future<ProposalSummary> sendCapture({
    required String token,
    required String projectId,
    required Uint8List imageBytes,
    required String fileName,
    required String mimeType,
    String? prompt,
  }) async {
    // 1. Validación de tamaño (Límite 5 MB)
    if (imageBytes.lengthInBytes > ApiConfig.maxImageSizeBytes) {
      throw Exception('No se puede enviar la imagen porque supera el tamaño permitido (máximo 5 MB).');
    }

    if (imageBytes.isEmpty) {
      throw Exception('El archivo de imagen está vacío o corrupto.');
    }

    // 2. Validación de formato
    final cleanMime = mimeType.toLowerCase().trim();
    if (!ApiConfig.allowedMimeTypes.contains(cleanMime)) {
      throw Exception('Formato no compatible ($cleanMime). Formatos permitidos: PNG, JPG, JPEG, WEBP.');
    }

    // 3. Conversión a base64
    final base64Image = base64Encode(imageBytes);

    final payload = {
      'image': {
        'data': base64Image,
        'mimeType': cleanMime,
      },
      if (prompt != null && prompt.trim().isNotEmpty) 'prompt': prompt.trim(),
    };

    final url = Uri.parse(ApiConfig.mobileCaptureUrl(projectId));

    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(payload),
    ).timeout(
      const Duration(seconds: 40),
      onTimeout: () => throw Exception('Tiempo de espera agotado al analizar el diagrama con IA. Por favor intenta nuevamente.'),
    );

    dynamic bodyData;
    try {
      bodyData = jsonDecode(response.body);
    } catch (_) {
      throw Exception('Respuesta inesperada del servidor.');
    }

    if (response.statusCode == 200 || response.statusCode == 201) {
      return ProposalSummary.fromJson(bodyData as Map<String, dynamic>);
    }

    final message = bodyData is Map ? bodyData['message'] : null;
    final serverMsg = message?.toString() ?? '';

    switch (response.statusCode) {
      case 401:
        throw Exception('Sesión expirada o inválida. Inicia sesión nuevamente.');
      case 403:
        throw Exception('No tienes permisos de acceso a este proyecto.');
      case 404:
        throw Exception('El proyecto seleccionado no existe o fue eliminado.');
      case 429:
        throw Exception('Límite de solicitudes de IA alcanzado. Por favor espera un momento e intenta nuevamente.');
      case 503:
        throw Exception(serverMsg.isNotEmpty ? serverMsg : 'El servicio de IA se encuentra temporalmente sobrecargado.');
      case 502:
      case 504:
        throw Exception(serverMsg.isNotEmpty ? serverMsg : 'El análisis con IA tardó demasiado o devolvió una respuesta inválida.');
      default:
        throw Exception(serverMsg.isNotEmpty ? serverMsg : 'No fue posible analizar la imagen del diagrama.');
    }
  }

  Future<List<CaptureHistoryItem>> getMyCaptures(String token) async {
    if (token.isEmpty) {
      throw Exception('Sesión no autenticada.');
    }

    final response = await http.get(
      Uri.parse(ApiConfig.myCapturesUrl()),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    ).timeout(
      const Duration(seconds: 15),
      onTimeout: () => throw Exception('Tiempo de espera agotado al obtener el historial de capturas.'),
    );

    if (response.statusCode == 401) {
      throw Exception('Sesión expirada.');
    }

    if (response.statusCode != 200) {
      final dynamic data = jsonDecode(response.body);
      final message = data is Map ? data['message'] : null;
      throw Exception(message?.toString() ?? 'Error al cargar el historial de capturas.');
    }

    final List<dynamic> list = jsonDecode(response.body) as List<dynamic>;
    return list.map((item) => CaptureHistoryItem.fromJson(item as Map<String, dynamic>)).toList();
  }

  String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB';
  }

  String detectMimeType(String pathOrName) {
    final lower = pathOrName.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }
}
