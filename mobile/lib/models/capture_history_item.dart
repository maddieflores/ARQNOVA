import 'proposal_summary.dart';

class CaptureHistoryItem {
  final String id;
  final String projectId;
  final String projectName;
  final String status;
  final String origin;
  final String summary;
  final ProposalCounts counts;
  final DateTime createdAt;

  CaptureHistoryItem({
    required this.id,
    required this.projectId,
    required this.projectName,
    required this.status,
    required this.origin,
    required this.summary,
    required this.counts,
    required this.createdAt,
  });

  factory CaptureHistoryItem.fromJson(Map<String, dynamic> json) {
    final project = json['project'] as Map<String, dynamic>?;
    final projectName = project?['name'] as String? ?? 'Proyecto';

    return CaptureHistoryItem(
      id: json['id'] as String? ?? '',
      projectId: json['projectId'] as String? ?? '',
      projectName: projectName,
      status: json['status'] as String? ?? 'PENDING',
      origin: json['origin'] as String? ?? 'MOBILE_IMAGE',
      summary: json['summary'] as String? ?? 'Captura UML',
      counts: ProposalCounts(
        classes: json['classesCount'] as int? ?? 0,
        attributes: json['attributesCount'] as int? ?? 0,
        methods: json['methodsCount'] as int? ?? 0,
        relations: json['relationsCount'] as int? ?? 0,
      ),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  String get statusDisplay {
    switch (status) {
      case 'PENDING':
        return 'Pendiente de revisión';
      case 'APPLIED':
        return 'Aplicada';
      case 'REJECTED':
        return 'Rechazada';
      case 'ERROR':
        return 'Error';
      default:
        return status;
    }
  }
}
