class Project {
  final String id;
  final String name;
  final String? description;
  final String ownerId;
  final DateTime createdAt;

  Project({
    required this.id,
    required this.name,
    this.description,
    required this.ownerId,
    required this.createdAt,
  });

  factory Project.fromJson(Map<String, dynamic> json) {
    return Project(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      ownerId: json['ownerId'] as String? ?? '',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'ownerId': ownerId,
        'createdAt': createdAt.toIso8601String(),
      };
}
