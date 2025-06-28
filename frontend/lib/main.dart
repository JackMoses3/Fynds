import 'package:flutter/material.dart';
import 'package:fynds/screens/auth/title_screen.dart';
import 'package:fynds/services/auth/auth_service.dart';
import 'package:fynds/navigation/app_navigation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:fynds/screens/onboarding/user_details_screen.dart';
import 'package:fynds/theme/app_theme.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
const String appTitle = 'Fynds';
const String appSubtitle = 'Finding fashion for you';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final cache = PaintingBinding.instance.imageCache;
  cache.maximumSize = 4000; // 4k thumbs
  cache.maximumSizeBytes = 400 << 20; // 400 MB
  // Initialize shared preferences to check if onboarding is complete
  final prefs = await SharedPreferences.getInstance();
  final done = prefs.getBool('onboardingComplete') ?? false;
  // check if the user is authenticated
  final authService = AuthService();
  final bool isAuthenticated = await authService.checkLoginStatus();

  String initialRoute;
  if (!isAuthenticated) {
    // Not authenticated -> go to auth flow
    initialRoute = '/title';
    print('🐛 [MAIN] Routing to /title (not authenticated)');
  } else if (!done) {
    // Authenticated but onboarding not done -> go to onboarding
    initialRoute = '/onboarding';
    print('🐛 [MAIN] Routing to /onboarding (authenticated, need onboarding)');
  } else {
    // Authenticated and onboarding done -> go to home
    initialRoute = '/home';
    print('🐛 [MAIN] Routing to /home (authenticated, onboarding done)');
  }

  runApp(
    MyApp(
      onboardingDone: done,
      isAuthenticated: isAuthenticated,
      initialRoute: initialRoute,
    ),
  );
}

class MyApp extends StatelessWidget {
  final bool onboardingDone;
  final bool isAuthenticated;
  final String initialRoute;
  const MyApp({
    super.key,
    required this.onboardingDone,
    required this.isAuthenticated,
    required this.initialRoute,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fynds',
      navigatorKey: navigatorKey,
      theme: AppTheme.lightTheme,
      initialRoute: initialRoute, // Use the calculated route
      routes: {
        '/title':
            (context) => TitleScreen(title: appTitle, subtitle: appSubtitle),
        '/home': (context) => const AppNavigation(),
        '/onboarding': (context) => const UserDetailsScreen(),
      },
    );
  }
}
