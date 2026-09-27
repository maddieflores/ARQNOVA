import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../config/api_config.dart';
import '../models/auth_user.dart';
import '../models/project.dart';
import '../services/capture_service.dart';
import 'analysis_result_screen.dart';

class CaptureScreen extends StatefulWidget {
  final AuthUser currentUser;
  final Project selectedProject;

  const CaptureScreen({
    super.key,
    required this.currentUser,
    required this.selectedProject,
  });

  @override
  State<CaptureScreen> createState() => _CaptureScreenState();
}

class _CaptureScreenState extends State<CaptureScreen> {
  final ImagePicker _picker = ImagePicker();
  final CaptureService _captureService = CaptureService();
  final TextEditingController _promptController = TextEditingController();

  Uint8List? _imageBytes;
  String? _fileName;
  String? _mimeType;
  int _fileSizeBytes = 0;
  bool _isAnalyzing = false;
  String? _errorMessage;

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _pickFromCamera() async {
    setState(() {
      _errorMessage = null;
    });

    try {
      final XFile? file = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 2400,
        maxHeight: 2400,
        imageQuality: 90,
      );

      if (file == null) return; // User cancelled

      await _processSelectedFile(file);
    } catch (e) {
      setState(() {
        final errorStr = e.toString().toLowerCase();
        if (errorStr.contains('permission') || errorStr.contains('denied')) {
          _errorMessage = 'Permiso de cámara denegado. Por favor concede acceso a la cámara en los ajustes de tu dispositivo.';
        } else {
          _errorMessage = 'No se pudo acceder a la cámara o el dispositivo no cuenta con cámara disponible.';
        }
      });
    }
  }

  Future<void> _pickFromGallery() async {
    setState(() {
      _errorMessage = null;
    });

    try {
      final XFile? file = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 2400,
        maxHeight: 2400,
        imageQuality: 90,
      );

      if (file == null) return; // User cancelled

      await _processSelectedFile(file);
    } catch (e) {
      setState(() {
        _errorMessage = 'Error al seleccionar imagen de la galería.';
      });
    }
  }

  Future<void> _processSelectedFile(XFile file) async {
    final bytes = await file.readAsBytes();
    final size = bytes.lengthInBytes;

    // Validación de límite de tamaño (5 MB)
    if (size > ApiConfig.maxImageSizeBytes) {
      setState(() {
        _imageBytes = null;
        _fileName = null;
        _errorMessage = 'No se puede enviar la imagen porque supera el tamaño permitido (máximo 5 MB).';
      });
      return;
    }

    final name = file.name.isNotEmpty ? file.name : 'captura_uml.jpg';
    final mime = _captureService.detectMimeType(file.path.isNotEmpty ? file.path : name);

    setState(() {
      _imageBytes = bytes;
      _fileName = name;
      _fileSizeBytes = size;
      _mimeType = mime;
      _errorMessage = null;
    });
  }

  void _clearImage() {
    setState(() {
      _imageBytes = null;
      _fileName = null;
      _fileSizeBytes = 0;
      _mimeType = null;
      _errorMessage = null;
    });
  }

  Future<void> _sendForAnalysis() async {
    if (_imageBytes == null || _mimeType == null) {
      setState(() {
        _errorMessage = 'Por favor toma una foto o selecciona una imagen antes de enviar.';
      });
      return;
    }

    setState(() {
      _isAnalyzing = true;
      _errorMessage = null;
    });

    try {
      final summary = await _captureService.sendCapture(
        token: widget.currentUser.token,
        projectId: widget.selectedProject.id,
        imageBytes: _imageBytes!,
        fileName: _fileName ?? 'captura.png',
        mimeType: _mimeType!,
        prompt: _promptController.text.trim(),
      );

      if (!mounted) return;

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => AnalysisResultScreen(
            summary: summary,
            currentUser: widget.currentUser,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _isAnalyzing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0E1535),
      appBar: AppBar(
        backgroundColor: const Color(0xFF131B3E),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Capturar diagrama UML',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            Text(
              widget.selectedProject.name,
              style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.6)),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Project header pill
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF131B3E),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF1E2958)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.folder_outlined, color: Color(0xFF818CF8), size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Proyecto destino: ${widget.selectedProject.name}',
                        style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Error alert box
              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.15),
                    border: Border.all(color: Colors.red.withValues(alpha: 0.5)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),

              // Image Preview or Selection Area
              if (_imageBytes == null)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
                  decoration: BoxDecoration(
                    color: const Color(0xFF131B3E),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: const Color(0xFF1E2958),
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4F46E5).withValues(alpha: 0.2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.camera_alt_rounded,
                          size: 40,
                          color: Color(0xFF818CF8),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Captura un diagrama UML físico, papel o pantalla',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Formatos: PNG, JPG, JPEG, WEBP (Máximo 5 MB)',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.5),
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Selection Buttons
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: _isAnalyzing ? null : _pickFromCamera,
                              icon: const Icon(Icons.camera_alt_outlined, size: 18),
                              label: const Text('Tomar foto'),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 13),
                                backgroundColor: const Color(0xFF4F46E5),
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _isAnalyzing ? null : _pickFromGallery,
                              icon: const Icon(Icons.photo_library_outlined, size: 18),
                              label: const Text('Galería'),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 13),
                                foregroundColor: Colors.white,
                                side: const BorderSide(color: Color(0xFF6366F1)),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                )
              else
                // Preview Area
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(
                        color: const Color(0xFF131B3E),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF6366F1)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Image preview container
                          Container(
                            constraints: const BoxConstraints(maxHeight: 280),
                            color: Colors.black26,
                            child: Image.memory(
                              _imageBytes!,
                              fit: BoxFit.contain,
                            ),
                          ),

                          // File metadata bar
                          Padding(
                            padding: const EdgeInsets.all(14.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        _fileName ?? 'Imagen UML',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF1E2958),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        _captureService.formatFileSize(_fileSizeBytes),
                                        style: const TextStyle(
                                          color: Color(0xFF818CF8),
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Formato: ${_mimeType?.replaceAll('image/', '').toUpperCase()}',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.5),
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Additional optional prompt
                    TextField(
                      controller: _promptController,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: 'Instrucción adicional para la IA (opcional)',
                        labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
                        hintText: 'Ej. Identificar multiplicidades y atributos clave',
                        hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 12),
                        filled: true,
                        fillColor: const Color(0xFF131B3E),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF1E2958)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF1E2958)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF6366F1)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Actions: "Analizar imagen", "Cambiar imagen", "Cancelar"
                    ElevatedButton.icon(
                      onPressed: _isAnalyzing ? null : _sendForAnalysis,
                      icon: _isAnalyzing
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.auto_awesome_rounded, size: 20),
                      label: Text(
                        _isAnalyzing ? 'Analizando con IA…' : 'Analizar imagen',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 15),
                        backgroundColor: const Color(0xFF4F46E5),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 2,
                      ),
                    ),
                    const SizedBox(height: 10),

                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _isAnalyzing ? null : _pickFromCamera,
                            icon: const Icon(Icons.change_circle_outlined, size: 16),
                            label: const Text('Cambiar foto'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              foregroundColor: Colors.white70,
                              side: const BorderSide(color: Color(0xFF1E2958)),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _isAnalyzing ? null : _clearImage,
                            icon: const Icon(Icons.close_rounded, size: 16),
                            label: const Text('Cancelar'),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              foregroundColor: Colors.white70,
                              side: const BorderSide(color: Color(0xFF1E2958)),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
