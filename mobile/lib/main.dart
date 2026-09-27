import 'package:flutter/material.dart';
import 'models/auth_user.dart';
import 'screens/login_screen.dart';
import 'screens/projects_screen.dart';
import 'services/auth_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final authService = AuthService();
  final initialUser = await authService.restoreSession();

  runApp(ArqnovaMobileApp(
    authService: authService,
    initialUser: initialUser,
  ));
}

class ArqnovaMobileApp extends StatelessWidget {
  final AuthService authService;
  final AuthUser? initialUser;

  const ArqnovaMobileApp({
    super.key,
    required this.authService,
    this.initialUser,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ARQNOVA Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0E1535),
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFF6366F1),
          secondary: const Color(0xFF8B5CF6),
          surface: const Color(0xFF131B3E),
        ),
        fontFamily: 'Roboto',
      ),
      home: initialUser != null
          ? ProjectsScreen(
              authService: authService,
              currentUser: initialUser!,
            )
          : LoginScreen(
              authService: authService,
            ),
    );
  }
}
