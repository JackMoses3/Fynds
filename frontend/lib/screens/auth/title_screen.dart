import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:fynds/screens/auth/login_screen.dart';
import 'package:fynds/screens/onboarding/user_details_screen.dart';
import 'package:fynds/services/auth/auth_service.dart'; // Add this in pubspec.yaml
import 'package:fynds/screens/auth/email_signup_screen.dart'; // Add this in pubspec.yaml

class TitleScreen extends StatelessWidget {
  final String title;
  final String subtitle;
  TitleScreen({super.key, required this.title, required this.subtitle});
  final AuthService _authService = AuthService();

  void _handleGoogleLogin(BuildContext context) async {
    final success = await _authService.loginWithGoogle();
    if (success) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => UserDetailsScreen()),
      );
    }
  }

  void _handleEmailLogin(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const EmailSignUpScreen()),
    );
  }

  void _navigateToLogin(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  Widget _buildLoginButton({
    required IconData icon,
    required String text,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          highlightColor: Colors.grey.shade300,
          splashColor: Colors.grey.shade200,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            child: Row(
              children: [
                Icon(icon, size: 24),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(text, style: const TextStyle(fontSize: 16)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              const Text(
                'Sign up for Fynds',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              _buildLoginButton(
                icon: Icons.person_rounded,
                text: 'Use email',
                onTap: () => _handleEmailLogin(context),
              ),
              _buildLoginButton(
                icon: FontAwesomeIcons.google,
                text: 'Continue with Google',
                onTap: () => _handleGoogleLogin(context),
              ),
              const Spacer(),
              Divider(),
              TextButton(
                onPressed: () => _navigateToLogin(context),
                child: const Text(
                  'Already have an account? Log in',
                  style: TextStyle(fontSize: 14),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
