import 'package:flutter/material.dart';
import 'package:fynds/screens/onboarding/user_details_screen.dart';
import 'package:fynds/services/auth/auth_service.dart';
import 'package:fynds/theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _authService = AuthService();

  final emailController = TextEditingController();
  final passwordController = TextEditingController();

  String? _errorMessage;
  bool _isLoading = false;

  void _login(BuildContext context) async {
    if (!_formKey.currentState!.validate()) return;

    final email = emailController.text.trim();
    final password = passwordController.text.trim();

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final success = await _authService.loginWithEmail(email, password);
      if (success) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => UserDetailsScreen()),
        );
      } else {
        setState(() => _errorMessage = 'Invalid credentials.');
      }
    } catch (e) {
      setState(() => _errorMessage = 'An unexpected error occurred.');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _handleGoogleLogin(BuildContext context) async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final success = await _authService.loginWithGoogle();
      if (success) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => UserDetailsScreen()),
        );
      } else {
        setState(() => _errorMessage = 'Google login failed.');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Google login error occurred.');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Widget _buildSocialButton({
    required String iconPath,
    required String text,
    required VoidCallback onPressed,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: OutlinedButton(
        onPressed: _isLoading ? null : onPressed,
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
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
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
            height: 150, // Reduced from 200 for better proportion
            decoration: const BoxDecoration(color: AppTheme.primaryColor),
            child: const SafeArea(child: SizedBox()),
          ),

          // Bottom white section with scrollable form
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(color: AppTheme.backgroundColor),
              child: SafeArea(
                top: false,
                child: SingleChildScrollView(
                  // ✅ Make content scrollable
                  padding: const EdgeInsets.all(32),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Welcome Back Title
                        Text(
                          'Welcome Back',
                          style: AppTheme.textTheme.headlineLarge,
                        ),

                        const SizedBox(height: 32),

                        // Email Input
                        TextFormField(
                          controller: emailController,
                          decoration: const InputDecoration(
                            hintText: 'Email address',
                            hintStyle: TextStyle(color: AppTheme.textSecondary),
                          ),
                          style: const TextStyle(color: AppTheme.textPrimary),
                          keyboardType: TextInputType.emailAddress,
                          validator: (val) {
                            if (val == null || val.isEmpty) return 'Required';
                            final emailRegex = RegExp(
                              r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                            );
                            if (!emailRegex.hasMatch(val))
                              return 'Invalid email';
                            return null;
                          },
                        ),

                        const SizedBox(height: 16),

                        // Password Input
                        TextFormField(
                          controller: passwordController,
                          decoration: const InputDecoration(
                            hintText: 'Password',
                            hintStyle: TextStyle(color: AppTheme.textSecondary),
                          ),
                          style: const TextStyle(color: AppTheme.textPrimary),
                          obscureText: true,
                          validator:
                              (val) =>
                                  val == null || val.isEmpty
                                      ? 'Required'
                                      : null,
                        ),

                        const SizedBox(height: 24),

                        // Error Message
                        if (_errorMessage != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(
                                color: AppTheme.errorColor,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),

                        // Login Button
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed:
                                _isLoading ? null : () => _login(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.buttonSecondary,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child:
                                _isLoading
                                    ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        color: Colors.white,
                                        strokeWidth: 2,
                                      ),
                                    )
                                    : const Text(
                                      'Log in',
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

                        // Google Login Button
                        _buildSocialButton(
                          iconPath: 'assets/images/Google.png',
                          text: 'Continue with Google',
                          onPressed: () => _handleGoogleLogin(context),
                        ),

                        const SizedBox(height: 16),

                        // Apple Login Button
                        _buildSocialButton(
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

                        const SizedBox(
                          height: 40,
                        ), // ✅ Extra space for keyboard
                        // Sign up link
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text(
                              "Don't have an account? ",
                              style: TextStyle(
                                fontSize: 14,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                            GestureDetector(
                              onTap: () => Navigator.pop(context),
                              child: const Text(
                                'Sign up',
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
          ),
        ],
      ),
    );
  }
}
