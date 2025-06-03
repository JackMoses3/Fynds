import 'package:flutter/material.dart';
import 'package:fynds/screens/onboarding/user_details_screen.dart';
import 'package:fynds/services/auth/auth_service.dart';

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

  InputDecoration _inputDecoration(String hintText) => InputDecoration(
    hintText: hintText,
    filled: true,
    fillColor: Colors.grey.shade100,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: BorderSide.none,
    ),
  );

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Stack(
                  alignment: Alignment.center,
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: IconButton(
                        icon: const Icon(Icons.arrow_back),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ),
                    const Text(
                      'Log in',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),
                TextFormField(
                  controller: emailController,
                  decoration: _inputDecoration('Email'),
                  keyboardType: TextInputType.emailAddress,
                  validator: (val) {
                    if (val == null || val.isEmpty) return 'Required';
                    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
                    if (!emailRegex.hasMatch(val)) return 'Invalid email';
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: passwordController,
                  decoration: _inputDecoration('Password'),
                  obscureText: true,
                  validator:
                      (val) => val == null || val.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 24),
                if (_errorMessage != null)
                  Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red),
                    textAlign: TextAlign.center,
                  ),
                ElevatedButton(
                  onPressed: _isLoading ? null : () => _login(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child:
                      _isLoading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text('Log in'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
