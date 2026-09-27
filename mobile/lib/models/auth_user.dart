class AuthUser {
  final String id;
  final String name;
  final String email;
  final String role;
  final String token;

  AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.token,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json, String token) {
    final user = json['user'] as Map<String, dynamic>? ?? json;
    final roleObj = user['role'];
    final roleName = roleObj is Map<String, dynamic>
        ? (roleObj['name'] as String? ?? 'COLABORADOR')
        : (roleObj as String? ?? 'COLABORADOR');

    return AuthUser(
      id: user['id'] as String? ?? '',
      name: user['name'] as String? ?? '',
      email: user['email'] as String? ?? '',
      role: roleName,
      token: token,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'role': role,
        'token': token,
      };
}
