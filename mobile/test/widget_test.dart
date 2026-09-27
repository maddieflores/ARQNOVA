import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:arqnova_mobile/models/proposal_summary.dart';
import 'package:arqnova_mobile/models/auth_user.dart';
import 'package:arqnova_mobile/screens/analysis_result_screen.dart';

void main() {
  testWidgets('AnalysisResultScreen muestra resumen de entidades detectadas y estado', (WidgetTester tester) async {
    final summary = ProposalSummary(
      id: 'prop-1',
      projectId: 'proj-1',
      projectName: 'Sistema Biblioteca',
      status: 'PENDING',
      origin: 'MOBILE_IMAGE',
      summary: 'Detectadas 4 clases y relaciones',
      counts: ProposalCounts(
        classes: 4,
        attributes: 11,
        methods: 3,
        relations: 5,
      ),
      message: 'Propuesta enviada al proyecto.',
      createdAt: DateTime.now(),
    );

    final user = AuthUser(
      id: 'u-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'ANFITRION',
      token: 'jwt',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: AnalysisResultScreen(
          summary: summary,
          currentUser: user,
        ),
      ),
    );

    expect(find.text('¡Análisis completado!'), findsOneWidget);
    expect(find.text('Proyecto: Sistema Biblioteca'), findsOneWidget);
    expect(find.text('Clases detectadas'), findsOneWidget);
    expect(find.text('4'), findsOneWidget);
    expect(find.text('Atributos detectados'), findsOneWidget);
    expect(find.text('11'), findsOneWidget);
    expect(find.text('Métodos detectados'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('Relaciones detectadas'), findsOneWidget);
    expect(find.text('5'), findsOneWidget);
    expect(find.text('Propuesta enviada al proyecto.'), findsOneWidget);
    expect(
      find.text('Continúa en ARQNOVA Web para revisar el diagrama en el editor UML y aplicar los cambios.'),
      findsOneWidget,
    );
  });
}
