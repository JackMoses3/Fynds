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

  Widget _buildSignUpButton(
    BuildContext context, {
    String? iconPath,
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
            if (iconPath != null) ...[
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                child: Image.asset(
                  iconPath,
                  width: _getIconSize(iconPath), // Custom size per icon
                  height: _getIconSize(iconPath), // Custom size per icon
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(width: 12),
            ],
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

  double _getIconSize(String iconPath) {
    if (iconPath.contains('Google')) {
      return 26.0; // Adjust Google icon size
    } else if (iconPath.contains('Apple')) {
      return 18.0; // Adjust Apple icon size
    }
    return 24.0; // Default size
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.primaryColor, // Set background to pink
      body: Column(
        // Remove SafeArea to allow red to extend to top
        children: [
          // Top section with brand colors and text
          Expanded(
            flex: 5,
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(color: AppTheme.primaryColor),
              child: SafeArea(
                // Only apply SafeArea to content inside
                child: const Column(
                  mainAxisAlignment:
                      MainAxisAlignment.end, // Changed from center to end
                  children: [
                    // FYNDS Logo Text
                    Text(
                      'FYNDS',
                      style: TextStyle(
                        fontSize: 64,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 2.0,
                      ),
                    ),

                    SizedBox(height: 16),

                    // Subtitle
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        'Finding fashion curated for you',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),

                    SizedBox(height: 50), // Add some bottom spacing
                  ],
                ),
              ),
            ),
          ),

          // Bottom section with sign up options
          Expanded(
            flex: 6,
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color:
                    AppTheme.backgroundColor, // Explicitly set white background
              ),
              padding: const EdgeInsets.all(20),
              child: SafeArea(
                // Apply SafeArea only to bottom section
                top: false, // Don't apply to top since we want red to extend
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Sign Up Title - Made smaller
                    Text('Sign Up', style: AppTheme.textTheme.headlineLarge),

                    const SizedBox(height: 20),

                    // Google Sign Up Button
                    _buildSignUpButton(
                      context,
                      iconPath: 'assets/images/Google.png',
                      text: 'Continue with Google',
                      onPressed: () => _handleGoogleLogin(context),
                    ),

                    const SizedBox(height: 16),

                    // Apple Sign Up Button
                    _buildSignUpButton(
                      context,
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

                    const SizedBox(height: 16),

                    // Email Sign Up Button
                    _buildSignUpButton(
                      context,
                      text: 'Continue with email',
                      onPressed: () => _handleEmailLogin(context),
                    ),

                    const SizedBox(height: 24),

                    // Already have account
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

                    const SizedBox(height: 30),

                    // Terms and Privacy
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: RichText(
                        textAlign: TextAlign.center,
                        text: const TextSpan(
                          style: TextStyle(
                            fontSize: 12,
                            color: AppTheme.textSecondary,
                          ),
                          children: [
                            TextSpan(text: 'By continuing, you agree to our '),
                            TextSpan(
                              text: 'Terms and Conditions',
                              style: TextStyle(
                                decoration: TextDecoration.underline,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            TextSpan(text: '\nand '),
                            TextSpan(
                              text: 'Privacy Policy',
                              style: TextStyle(
                                decoration: TextDecoration.underline,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            TextSpan(text: '.'),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
