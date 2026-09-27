class ProposalCounts {
  final int classes;
  final int attributes;
  final int methods;
  final int relations;

  ProposalCounts({
    required this.classes,
    required this.attributes,
    required this.methods,
    required this.relations,
  });

  factory ProposalCounts.fromJson(Map<String, dynamic>? json) {
    return ProposalCounts(
      classes: json?['classes'] as int? ?? 0,
      attributes: json?['attributes'] as int? ?? 0,
      methods: json?['methods'] as int? ?? 0,
      relations: json?['relations'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'classes': classes,
        'attributes': attributes,
        'methods': methods,
        'relations': relations,
      };
}

class ProposalSummary {
  final String id;
  final String projectId;
  final String projectName;
  final String status;
  final String origin;
  final String summary;
  final ProposalCounts counts;
  final String message;
  final DateTime createdAt;

  ProposalSummary({
    required this.id,
    required this.projectId,
    required this.projectName,
    required this.status,
    required this.origin,
    required this.summary,
    required this.counts,
    required this.message,
    required this.createdAt,
  });

  factory ProposalSummary.fromJson(Map<String, dynamic> json) {
    return ProposalSummary(
      id: json['id'] as String? ?? '',
      projectId: json['projectId'] as String? ?? '',
      projectName: json['projectName'] as String? ?? 'Proyecto',
      status: json['status'] as String? ?? 'PENDING',
      origin: json['origin'] as String? ?? 'MOBILE_IMAGE',
      summary: json['summary'] as String? ?? 'Propuesta generada desde móvil',
      counts: ProposalCounts.fromJson(json['counts'] as Map<String, dynamic>?),
      message: json['message'] as String? ??
          'Propuesta enviada al proyecto. Continúa en ARQNOVA Web para revisar y aplicar los cambios.',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
