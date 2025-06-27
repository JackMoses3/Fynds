import 'package:flutter/material.dart';
import 'package:fynds/services/auth/auth_service.dart';
import 'package:fynds/screens/auth/verify_screen.dart';
import 'package:fynds/theme/app_theme.dart';

class EmailSignUpScreen extends StatefulWidget {
  const EmailSignUpScreen({super.key});

  @override
  State<EmailSignUpScreen> createState() => _EmailSignUpScreenState();
}

class _EmailSignUpScreenState extends State<EmailSignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _authService = AuthService();

  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final confirmPasswordController = TextEditingController();
  final firstNameController = TextEditingController();
  final lastNameController = TextEditingController();

  String? _errorMessage;
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  void _register(BuildContext context) async {
    if (!_formKey.currentState!.validate()) return;

    final email = emailController.text.trim();
    final password = passwordController.text.trim();
    final confirmPassword = confirmPasswordController.text.trim();
    final firstName = firstNameController.text.trim();
    final lastName = lastNameController.text.trim();

    // Check if passwords match
    if (password != confirmPassword) {
      setState(() => _errorMessage = 'Passwords do not match.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final success = await _authService.registerWithEmail(
        email,
        firstName,
        lastName,
        password,
      );
      if (success) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => VerifyScreen(email: email)),
        );
      } else {
        setState(
          () => _errorMessage = 'Email already exists or registration failed.',
        );
      }
    } catch (e) {
      if (e.toString().contains('email already exists')) {
        setState(() => _errorMessage = 'This email is already in use.');
      } else if (e.toString().contains('password too weak')) {
        setState(
          () =>
              _errorMessage =
                  'Password is too weak. Must include letters, numbers, and symbols.',
        );
      } else {
        setState(() => _errorMessage = 'An unexpected error occurred.');
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    confirmPasswordController.dispose();
    firstNameController.dispose();
    lastNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: Column(
        children: [
          // Top pink section (no back arrow here)
          Container(
            width: double.infinity,
            height: 150,
            decoration: const BoxDecoration(color: AppTheme.primaryColor),
            child: const SafeArea(
              child: SizedBox(), // Empty pink section
            ),
          ),

          // Bottom white section with signup form
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(color: AppTheme.backgroundColor),
              padding: const EdgeInsets.all(32),
              child: SafeArea(
                top: false,
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Header with back arrow and Sign Up title
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(
                              Icons.arrow_back,
                              color: AppTheme.textPrimary, // Black arrow
                              size: 24,
                            ),
                            onPressed: () => Navigator.pop(context),
                            padding: EdgeInsets.zero,
                          ),
                          Expanded(
                            child: Text(
                              'Sign Up',
                              textAlign: TextAlign.center,
                              style: AppTheme.textTheme.headlineLarge,
                            ),
                          ),
                          const SizedBox(width: 48), // Balance the arrow space
                        ],
                      ),

                      const SizedBox(height: 32),

                      // First Name Input
                      TextFormField(
                        controller: firstNameController,
                        decoration: const InputDecoration(
                          hintText: 'First name',
                          hintStyle: TextStyle(color: AppTheme.textSecondary),
                        ),
                        style: const TextStyle(color: AppTheme.textPrimary),
                        validator:
                            (val) =>
                                val == null || val.isEmpty ? 'Required' : null,
                      ),

                      const SizedBox(height: 16),

                      // Last Name Input
                      TextFormField(
                        controller: lastNameController,
                        decoration: const InputDecoration(
                          hintText: 'Surname',
                          hintStyle: TextStyle(color: AppTheme.textSecondary),
                        ),
                        style: const TextStyle(color: AppTheme.textPrimary),
                        validator:
                            (val) =>
                                val == null || val.isEmpty ? 'Required' : null,
                      ),

                      const SizedBox(height: 16),

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
                          if (!emailRegex.hasMatch(val)) return 'Invalid email';
                          return null;
                        },
                      ),

                      const SizedBox(height: 16),

                      // Password Input
                      TextFormField(
                        controller: passwordController,
                        decoration: InputDecoration(
                          hintText: 'Password',
                          hintStyle: const TextStyle(
                            color: AppTheme.textSecondary,
                          ),
                          suffixIcon: TextButton(
                            onPressed:
                                () => setState(
                                  () => _obscurePassword = !_obscurePassword,
                                ),
                            child: Text(
                              _obscurePassword ? 'Show' : 'Hide',
                              style: const TextStyle(
                                color: AppTheme.textPrimary,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ),
                        style: const TextStyle(color: AppTheme.textPrimary),
                        obscureText: _obscurePassword,
                        validator: (val) {
                          if (val == null || val.isEmpty) return 'Required';
                          if (val.length < 8 ||
                              !RegExp(
                                r'[0-9A-Za-z!@#\$%^&*()]',
                              ).hasMatch(val)) {
                            return 'Password must be at least 8 characters with letters, numbers, and symbols';
                          }
                          return null;
                        },
                      ),

                      const SizedBox(height: 16),

                      // Confirm Password Input
                      TextFormField(
                        controller: confirmPasswordController,
                        decoration: InputDecoration(
                          hintText: 'Confirm password',
                          hintStyle: const TextStyle(
                            color: AppTheme.textSecondary,
                          ),
                          suffixIcon: TextButton(
                            onPressed:
                                () => setState(
                                  () =>
                                      _obscureConfirmPassword =
                                          !_obscureConfirmPassword,
                                ),
                            child: Text(
                              _obscureConfirmPassword ? 'Show' : 'Hide',
                              style: const TextStyle(
                                color: AppTheme.textPrimary,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ),
                        style: const TextStyle(color: AppTheme.textPrimary),
                        obscureText: _obscureConfirmPassword,
                        validator: (val) {
                          if (val == null || val.isEmpty) return 'Required';
                          if (val != passwordController.text)
                            return 'Passwords do not match';
                          return null;
                        },
                      ),

                      const SizedBox(height: 24),

                      // Error Message
                      if (_errorMessage != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(color: AppTheme.errorColor),
                            textAlign: TextAlign.center,
                          ),
                        ),

                      // Create Account Button
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          onPressed:
                              _isLoading ? null : () => _register(context),
                          style: ElevatedButton.styleFrom(
                            backgroundColor:
                                AppTheme.buttonSecondary, // Black button
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
                                    'Create account',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                        ),
                      ),

                      const Spacer(),

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
                              TextSpan(
                                text: 'By continuing, you agree to our ',
                              ),
                              TextSpan(
                                text: 'Terms and Conditions',
                                style: TextStyle(
                                  decoration: TextDecoration.underline,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              TextSpan(text: ' and '),
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
          ),
        ],
      ),
    );
  }
}
