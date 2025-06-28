import 'package:flutter/material.dart';
import 'package:fynds/screens/auth/login_screen.dart';
import 'package:fynds/screens/onboarding/user_details_screen.dart';
import 'package:fynds/services/auth/auth_service.dart';
import 'package:fynds/screens/auth/email_signup_screen.dart';
import 'package:fynds/theme/app_theme.dart';

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

  Widget _buildSignUpButton({
    required String iconPath,
    required String text,
    required VoidCallback onPressed,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: Colors.white,
          foregroundColor: AppTheme.textPrimary,
          side: const BorderSide(color: AppTheme.dividerColor, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: Image.asset(
                iconPath,
                width: 24,
                height: 24,
                fit: BoxFit.contain,
              ),
            ),
            const SizedBox(width: 12),
            Text(
              text,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppTheme.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      resizeToAvoidBottomInset: false, // ✅ Prevent screen resizing
      body: Column(
        children: [
          // Top pink section (fixed height)
          Container(
            width: double.infinity,
            height: 200,
            decoration: const BoxDecoration(color: AppTheme.primaryColor),
            child: const SafeArea(child: SizedBox()),
          ),

          // Bottom white section with scrollable content
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(color: AppTheme.backgroundColor),
              child: SafeArea(
                top: false,
                child: SingleChildScrollView(
                  // ✅ Make content scrollable
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Title
                      Text(
                        title,
                        textAlign: TextAlign.center,
                        style: AppTheme.textTheme.headlineLarge,
                      ),

                      const SizedBox(height: 16),

                      // Subtitle
                      Text(
                        subtitle,
                        textAlign: TextAlign.center,
                        style: AppTheme.textTheme.bodyLarge?.copyWith(
                          color: AppTheme.textSecondary,
                        ),
                      ),

                      const SizedBox(height: 48),

                      // Email signup button
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          onPressed: () => _handleEmailLogin(context),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.buttonSecondary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            'Continue with Email',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Divider with "or continue with"
                      Row(
                        children: [
                          Expanded(
                            child: Container(
                              height: 1,
                              color: AppTheme.dividerColor,
                            ),
                          ),
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 16),
                            child: Text(
                              'or continue with',
                              style: TextStyle(
                                fontSize: 14,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Container(
                              height: 1,
                              color: AppTheme.dividerColor,
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 24),

                      // Google signup button
                      _buildSignUpButton(
                        iconPath: 'assets/images/Google.png',
                        text: 'Continue with Google',
                        onPressed: () => _handleGoogleLogin(context),
                      ),

                      const SizedBox(height: 16),

                      // Apple signup button
                      _buildSignUpButton(
                        iconPath: 'assets/images/Apple.png',
                        text: 'Continue with Apple',
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Apple Sign In coming soon!'),
                            ),
                          );
                        },
                      ),

                      const SizedBox(height: 40), // ✅ Extra space for keyboard
                      // Login link
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text(
                            'Already have an account? ',
                            style: TextStyle(
                              fontSize: 14,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          GestureDetector(
                            onTap: () => _navigateToLogin(context),
                            child: const Text(
                              'Log in',
                              style: TextStyle(
                                fontSize: 14,
                                color: AppTheme.primaryColor,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
