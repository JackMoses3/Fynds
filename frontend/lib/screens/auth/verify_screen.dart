import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:fynds/screens/onboarding/user_details_screen.dart';
import 'package:fynds/services/auth/auth_service.dart';
import 'package:fynds/theme/app_theme.dart';

class VerifyScreen extends StatefulWidget {
  final String email;

  const VerifyScreen({super.key, required this.email});

  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen> {
  final TextEditingController _codeController = TextEditingController();
  final AuthService _authService = AuthService();
  bool _isLoading = false;
  String? _errorMessage;

  void _submitCode() async {
    final code = _codeController.text.trim();
    if (code.length == 8) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });

      try {
        final success = await _authService.verifyEmail(widget.email, code);
        if (success && mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (_) => UserDetailsScreen()),
          );
        } else {
          setState(() => _errorMessage = 'Invalid verification code.');
        }
      } catch (e) {
        setState(
          () => _errorMessage = 'Verification failed. Please try again.',
        );
      } finally {
        setState(() => _isLoading = false);
      }
    } else {
      setState(() => _errorMessage = 'Please enter all 8 digits');
    }
  }

  void _resendVerificationEmail() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final success = await _authService.newVerification(widget.email);
      if (success) {
        setState(() => _errorMessage = null);
      } else {
        setState(() => _errorMessage = 'Failed to resend verification code.');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Failed to resend verification code.');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      resizeToAvoidBottomInset: false, // Prevent screen resizing
      body: Column(
        children: [
          // Top pink section (fixed height)
          Container(
            width: double.infinity,
            height: 150,
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
                  // Make content scrollable
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Header with back arrow and title
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(
                              Icons.arrow_back,
                              color: AppTheme.textPrimary,
                              size: 24,
                            ),
                            onPressed: () => Navigator.pop(context),
                            padding: EdgeInsets.zero,
                          ),
                          Expanded(
                            child: Text(
                              'Verify Email',
                              textAlign: TextAlign.center,
                              style: AppTheme.textTheme.headlineLarge,
                            ),
                          ),
                          const SizedBox(width: 48), // Balance the arrow space
                        ],
                      ),

                      const SizedBox(height: 32),

                      // Verification instruction
                      Text(
                        'Enter the 8-digit code sent to',
                        style: AppTheme.textTheme.bodyLarge?.copyWith(
                          color: AppTheme.textSecondary,
                        ),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: 8),

                      Text(
                        widget.email,
                        style: AppTheme.textTheme.bodyLarge?.copyWith(
                          color: AppTheme.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.center,
                      ),

                      const SizedBox(height: 32),

                      // Verification code input
                      TextFormField(
                        controller: _codeController,
                        decoration: const InputDecoration(
                          hintText: 'Enter 8-digit code',
                          hintStyle: TextStyle(color: AppTheme.textSecondary),
                        ),
                        style: const TextStyle(
                          color: AppTheme.textPrimary,
                          fontSize: 18,
                          letterSpacing: 2,
                        ),
                        textAlign: TextAlign.center,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(8),
                        ],
                        onChanged: (value) {
                          if (value.length == 8) {
                            _submitCode();
                          }
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

                      // Verify Button
                      SizedBox(
                        width: double.infinity,
                        height: 56,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _submitCode,
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
                                    'Verify',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                        ),
                      ),

                      const SizedBox(height: 40), // Extra space for keyboard
                      // Resend code
                      RichText(
                        textAlign: TextAlign.center,
                        text: TextSpan(
                          style: const TextStyle(
                            fontSize: 14,
                            color: AppTheme.textSecondary,
                          ),
                          children: [
                            const TextSpan(text: "Didn't receive a code? "),
                            TextSpan(
                              text: 'Resend',
                              style: const TextStyle(
                                color: AppTheme.primaryColor,
                                fontWeight: FontWeight.w600,
                              ),
                              recognizer:
                                  TapGestureRecognizer()
                                    ..onTap =
                                        _isLoading
                                            ? null
                                            : _resendVerificationEmail,
                            ),
                          ],
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
