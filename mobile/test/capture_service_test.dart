import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:arqnova_mobile/models/proposal_summary.dart';
import 'package:arqnova_mobile/models/capture_history_item.dart';
import 'package:arqnova_mobile/models/project.dart';
import 'package:arqnova_mobile/models/auth_user.dart';
import 'package:arqnova_mobile/services/capture_service.dart';

void main() {
  group('CaptureService and Models Unit Tests', () {
    final captureService = CaptureService();

    test('Valida límite de tamaño de imagen (rechaza > 5MB)', () async {
      // 5MB + 1 byte
      final largeBytes = Uint8List(5 * 1024 * 1024 + 1);

      expect(
        () => captureService.sendCapture(
          token: 'dummy-token',
          projectId: 'dummy-proj',
          imageBytes: largeBytes,
          fileName: 'large.png',
          mimeType: 'image/png',
        ),
        throwsA(predicate((e) =>
            e.toString().contains('supera el tamaño permitido'))),
      );
    });

    test('Valida formatos no soportados', () async {
      final dummyBytes = Uint8List.fromList([1, 2, 3]);

      expect(
        () => captureService.sendCapture(
          token: 'dummy-token',
          projectId: 'dummy-proj',
          imageBytes: dummyBytes,
          fileName: 'doc.pdf',
          mimeType: 'application/pdf',
        ),
        throwsA(predicate((e) =>
            e.toString().contains('Formato no compatible'))),
      );
    });

    test('Formateo de tamaño de archivo', () {
      expect(captureService.formatFileSize(500), '500 B');
      expect(captureService.formatFileSize(2048), '2.0 KB');
      expect(captureService.formatFileSize(2 * 1024 * 1024), '2.00 MB');
    });

    test('Detección de MIME Type', () {
      expect(captureService.detectMimeType('foto.png'), 'image/png');
      expect(captureService.detectMimeType('foto.jpg'), 'image/jpeg');
      expect(captureService.detectMimeType('foto.jpeg'), 'image/jpeg');
      expect(captureService.detectMimeType('foto.webp'), 'image/webp');
    });

    test('ProposalSummary deserealiza correctamente', () {
      final json = {
        'id': 'prop-123',
        'projectId': 'proj-456',
        'projectName': 'Sistema Biblioteca',
        'status': 'PENDING',
        'origin': 'MOBILE_IMAGE',
        'summary': 'Detectadas 3 clases',
        'counts': {
          'classes': 3,
          'attributes': 8,
          'methods': 4,
          'relations': 2,
        },
        'message': 'Propuesta enviada al proyecto.',
        'createdAt': '2026-09-25T19:00:00.000Z',
      };

      final summary = ProposalSummary.fromJson(json);
      expect(summary.id, 'prop-123');
      expect(summary.projectName, 'Sistema Biblioteca');
      expect(summary.counts.classes, 3);
      expect(summary.counts.attributes, 8);
      expect(summary.counts.methods, 4);
      expect(summary.counts.relations, 2);
      expect(summary.status, 'PENDING');
    });

    test('CaptureHistoryItem serialización y display de estado', () {
      final json = {
        'id': 'cap-1',
        'projectId': 'proj-1',
        'project': {'id': 'proj-1', 'name': 'Tienda Online'},
        'status': 'PENDING',
        'origin': 'MOBILE_IMAGE',
        'summary': 'Captura UML',
        'classesCount': 2,
        'attributesCount': 5,
        'methodsCount': 1,
        'relationsCount': 1,
        'createdAt': '2026-09-25T19:10:00.000Z',
      };

      final item = CaptureHistoryItem.fromJson(json);
      expect(item.projectName, 'Tienda Online');
      expect(item.statusDisplay, 'Pendiente de revisión');
      expect(item.counts.classes, 2);
    });

    test('AuthUser model parsing', () {
      final json = {
        'id': 'user-1',
        'name': 'Ana Docente',
        'email': 'ana@example.com',
        'role': {'name': 'ANFITRION'},
      };

      final user = AuthUser.fromJson(json, 'token-xyz');
      expect(user.id, 'user-1');
      expect(user.name, 'Ana Docente');
      expect(user.role, 'ANFITRION');
      expect(user.token, 'token-xyz');
    });

    test('Project model parsing', () {
      final json = {
        'id': 'proj-10',
        'name': 'Sistema Académico',
        'description': 'Gestión de notas',
        'ownerId': 'user-1',
        'createdAt': '2026-09-20T10:00:00.000Z',
      };

      final project = Project.fromJson(json);
      expect(project.id, 'proj-10');
      expect(project.name, 'Sistema Académico');
      expect(project.description, 'Gestión de notas');
    });
  });
}
