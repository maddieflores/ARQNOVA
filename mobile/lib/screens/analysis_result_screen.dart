import 'package:flutter/material.dart';
import '../models/auth_user.dart';
import '../models/proposal_summary.dart';
import 'captures_history_screen.dart';

class AnalysisResultScreen extends StatelessWidget {
  final ProposalSummary summary;
  final AuthUser currentUser;

  const AnalysisResultScreen({
    super.key,
    required this.summary,
    required this.currentUser,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0E1535),
      appBar: AppBar(
        backgroundColor: const Color(0xFF131B3E),
        elevation: 0,
        automaticallyImplyLeading: false,
        title: const Text(
          'Resultado del análisis',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Success icon container
              Center(
                child: Container(
                  width: 76,
                  height: 76,
                  margin: const EdgeInsets.only(top: 10, bottom: 16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF10B981), Color(0xFF059669)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF10B981).withValues(alpha: 0.3),
                        blurRadius: 18,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    size: 44,
                    color: Colors.white,
                  ),
                ),
              ),

              const Text(
                '¡Análisis completado!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Proyecto: ${summary.projectName}',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF818CF8),
                ),
              ),
              const SizedBox(height: 24),

              // Summary Grid of Detected Entities
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: const Color(0xFF131B3E),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFF1E2958)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'RESUMEN DEL DIAGRAMA DETECTADO',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.1,
                        color: Colors.white60,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        _buildStatBox(
                          label: 'Clases detectadas',
                          count: summary.counts.classes,
                          icon: Icons.widgets_outlined,
                          color: const Color(0xFF6366F1),
                        ),
                        const SizedBox(width: 12),
                        _buildStatBox(
                          label: 'Atributos detectados',
                          count: summary.counts.attributes,
                          icon: Icons.list_alt_rounded,
                          color: const Color(0xFF38BDF8),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildStatBox(
                          label: 'Métodos detectados',
                          count: summary.counts.methods,
                          icon: Icons.functions_rounded,
                          color: const Color(0xFFA855F7),
                        ),
                        const SizedBox(width: 12),
                        _buildStatBox(
                          label: 'Relaciones detectadas',
                          count: summary.counts.relations,
                          icon: Icons.alt_route_rounded,
                          color: const Color(0xFF34D399),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Status Banner & Web Instructions
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF6366F1).withValues(alpha: 0.4)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF6366F1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.send_rounded, color: Colors.white, size: 14),
                        ),
                        const SizedBox(width: 10),
                        const Text(
                          'Propuesta enviada al proyecto.',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Continúa en ARQNOVA Web para revisar el diagrama en el editor UML y aplicar los cambios.',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Navigation Actions
              ElevatedButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back_rounded, size: 18),
                label: const Text('Volver a proyectos'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(
                      builder: (_) => CapturesHistoryScreen(currentUser: currentUser),
                    ),
                  );
                },
                icon: const Icon(Icons.history_rounded, size: 18),
                label: const Text('Ver mis capturas enviadas'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFF1E2958)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatBox({
    required String label,
    required int count,
    required IconData icon,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF0E1535),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF1E2958)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon, color: color, size: 20),
                Text(
                  count.toString(),
                  style: TextStyle(
                    color: color,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
