import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/auth_user.dart';
import '../models/capture_history_item.dart';
import '../services/capture_service.dart';

class CapturesHistoryScreen extends StatefulWidget {
  final AuthUser currentUser;

  const CapturesHistoryScreen({
    super.key,
    required this.currentUser,
  });

  @override
  State<CapturesHistoryScreen> createState() => _CapturesHistoryScreenState();
}

class _CapturesHistoryScreenState extends State<CapturesHistoryScreen> {
  final CaptureService _captureService = CaptureService();
  List<CaptureHistoryItem> _items = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await _captureService.getMyCaptures(widget.currentUser.token);
      if (!mounted) return;
      setState(() {
        _items = list;
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
        title: const Text(
          'Mis capturas UML',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadHistory,
          color: const Color(0xFF6366F1),
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
                              onPressed: _loadHistory,
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
                  : _items.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.camera_alt_outlined, size: 52, color: Colors.white.withValues(alpha: 0.3)),
                              const SizedBox(height: 16),
                              const Text(
                                'Aún no has enviado capturas UML.',
                                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Toma una foto de un diagrama para comenzar.',
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: _items.length,
                          itemBuilder: (context, index) {
                            final item = _items[index];
                            final formattedDate = DateFormat('dd/MM/yyyy HH:mm').format(item.createdAt);

                            return Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: const Color(0xFF131B3E),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: const Color(0xFF1E2958)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Row(
                                          children: [
                                            const Icon(Icons.folder_outlined, color: Color(0xFF818CF8), size: 16),
                                            const SizedBox(width: 6),
                                            Expanded(
                                              child: Text(
                                                item.projectName,
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 14,
                                                ),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      _buildStatusBadge(item.status, item.statusDisplay),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    item.summary,
                                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Clases: ${item.counts.classes} • Atrib: ${item.counts.attributes} • Rel: ${item.counts.relations}',
                                        style: const TextStyle(
                                          color: Color(0xFF818CF8),
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                      Text(
                                        formattedDate,
                                        style: TextStyle(
                                          color: Colors.white.withValues(alpha: 0.4),
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status, String display) {
    Color bg;
    Color fg;

    switch (status) {
      case 'PENDING':
        bg = const Color(0xFFF59E0B).withValues(alpha: 0.2);
        fg = const Color(0xFFFBBF24);
        break;
      case 'APPLIED':
        bg = const Color(0xFF10B981).withValues(alpha: 0.2);
        fg = const Color(0xFF34D399);
        break;
      case 'REJECTED':
        bg = const Color(0xFFEF4444).withValues(alpha: 0.2);
        fg = const Color(0xFFF87171);
        break;
      default:
        bg = const Color(0xFF6B7280).withValues(alpha: 0.2);
        fg = const Color(0xFF9CA3AF);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        display,
        style: TextStyle(
          color: fg,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
