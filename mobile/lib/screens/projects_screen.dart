import 'package:flutter/material.dart';
import '../models/auth_user.dart';
import '../models/project.dart';
import '../services/auth_service.dart';
import '../services/projects_service.dart';
import 'capture_screen.dart';
import 'captures_history_screen.dart';
import 'login_screen.dart';

class ProjectsScreen extends StatefulWidget {
  final AuthService authService;
  final AuthUser currentUser;

  const ProjectsScreen({
    super.key,
    required this.authService,
    required this.currentUser,
  });

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  final ProjectsService _projectsService = ProjectsService();
  List<Project> _projects = [];
  Project? _selectedProject;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  Future<void> _loadProjects() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _projectsService.getProjects(widget.currentUser.token);
      if (!mounted) return;
      setState(() {
        _projects = list;
        if (list.isNotEmpty && _selectedProject == null) {
          _selectedProject = list.first;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _navigateToCapture() {
    if (_selectedProject == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor selecciona un proyecto primero.')),
      );
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CaptureScreen(
          currentUser: widget.currentUser,
          selectedProject: _selectedProject!,
        ),
      ),
    );
  }

  void _navigateToHistory() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CapturesHistoryScreen(
          currentUser: widget.currentUser,
        ),
      ),
    );
  }

  Future<void> _logout() async {
    await widget.authService.logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => LoginScreen(authService: widget.authService),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0E1535),
      appBar: AppBar(
        backgroundColor: const Color(0xFF131B3E),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFF4F46E5),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.hub_rounded, size: 18, color: Colors.white),
            ),
            const SizedBox(width: 10),
            const Text(
              'ARQNOVA',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Colors.white),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.history_rounded, color: Colors.white70),
            tooltip: 'Mis capturas',
            onPressed: _navigateToHistory,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.white70),
            tooltip: 'Cerrar sesión',
            onPressed: _logout,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // User greeting banner
            Container(
              padding: const EdgeInsets.all(16),
              color: const Color(0xFF131B3E).withValues(alpha: 0.6),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: const Color(0xFF6366F1),
                    radius: 20,
                    child: Text(
                      widget.currentUser.name.isNotEmpty
                          ? widget.currentUser.name[0].toUpperCase()
                          : 'U',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.currentUser.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          '${widget.currentUser.email} • ${widget.currentUser.role}',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.6),
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Section Title
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Mis proyectos',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    '${_projects.length} disponibles',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.5),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),

            // Projects List or Loader or Error
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: Color(0xFF6366F1)),
                    )
                  : _errorMessage != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24.0),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 40),
                                const SizedBox(height: 12),
                                Text(
                                  _errorMessage!,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                                ),
                                const SizedBox(height: 16),
                                ElevatedButton.icon(
                                  onPressed: _loadProjects,
                                  icon: const Icon(Icons.refresh_rounded, size: 16),
                                  label: const Text('Reintentar'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF4F46E5),
                                    foregroundColor: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      : _projects.isEmpty
                          ? Center(
                              child: Text(
                                'No tienes proyectos disponibles.',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              itemCount: _projects.length,
                              itemBuilder: (context, index) {
                                final project = _projects[index];
                                final isSelected = _selectedProject?.id == project.id;

                                return Container(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? const Color(0xFF4F46E5).withValues(alpha: 0.25)
                                        : const Color(0xFF131B3E),
                                    border: Border.all(
                                      color: isSelected
                                          ? const Color(0xFF6366F1)
                                          : const Color(0xFF1E2958),
                                      width: isSelected ? 1.5 : 1.0,
                                    ),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: ListTile(
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                                    leading: Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: isSelected ? const Color(0xFF4F46E5) : const Color(0xFF1E2958),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Icon(
                                        Icons.account_tree_outlined,
                                        color: isSelected ? Colors.white : const Color(0xFF818CF8),
                                        size: 20,
                                      ),
                                    ),
                                    title: Text(
                                      project.name,
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                        fontSize: 14,
                                      ),
                                    ),
                                    subtitle: project.description != null && project.description!.isNotEmpty
                                        ? Text(
                                            project.description!,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              color: Colors.white.withValues(alpha: 0.5),
                                              fontSize: 11,
                                            ),
                                          )
                                        : null,
                                    trailing: isSelected
                                        ? const Icon(Icons.check_circle_rounded, color: Color(0xFF6366F1))
                                        : null,
                                    onTap: () {
                                      setState(() {
                                        _selectedProject = project;
                                      });
                                    },
                                  ),
                                );
                              },
                            ),
            ),

            // Action Button: "Capturar diagrama UML"
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFF131B3E),
                border: Border(
                  top: BorderSide(color: Color(0xFF1E2958)),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_selectedProject != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        children: [
                          Icon(Icons.check_circle_outline, size: 14, color: Colors.indigo.shade300),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Proyecto: ${_selectedProject!.name}',
                              style: TextStyle(
                                color: Colors.indigo.shade200,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ElevatedButton.icon(
                    onPressed: _selectedProject == null ? null : _navigateToCapture,
                    icon: const Icon(Icons.camera_alt_rounded, size: 20),
                    label: const Text(
                      'Capturar diagrama UML',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      backgroundColor: const Color(0xFF4F46E5),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
