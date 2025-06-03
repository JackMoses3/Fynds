import 'package:flutter/material.dart';
import 'package:fynds/services/auth/auth_service.dart';
import 'package:fynds/screens/auth/verify_screen.dart';

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
  final firstNameController = TextEditingController();
  final lastNameController = TextEditingController();

  String? _errorMessage;
  bool _isLoading = false;

  void _register(BuildContext context) async {
    final email = emailController.text.trim();
    final password = passwordController.text.trim();
    final firstName = firstNameController.text.trim();
    final lastName = lastNameController.text.trim();

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
    firstNameController.dispose();
    lastNameController.dispose();
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
                      'Sign up',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: firstNameController,
                        decoration: _inputDecoration('First Name'),
                        validator:
                            (val) =>
                                val == null || val.isEmpty ? 'Required' : null,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: TextFormField(
                        controller: lastNameController,
                        decoration: _inputDecoration('Last Name'),
                        validator:
                            (val) =>
                                val == null || val.isEmpty ? 'Required' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
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
                  validator: (val) {
                    if (val == null || val.isEmpty) return 'Required';
                    if (val.length < 8 ||
                        !RegExp(r'[0-9A-Za-z!@#\$%^&*()]').hasMatch(val)) {
                      return 'Password must be at least 8 characters with letters, numbers, and symbols';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                if (_errorMessage != null)
                  Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red),
                    textAlign: TextAlign.center,
                  ),
                ElevatedButton(
                  onPressed: _isLoading ? null : () => _register(context),
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
                          : const Text('Continue'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
