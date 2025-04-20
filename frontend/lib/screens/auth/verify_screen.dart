import 'package:flutter/material.dart';
import 'package:frontend/screens/auth/login_screen.dart';
import 'package:frontend/services/auth/auth_service.dart';

class VerifyScreen extends StatelessWidget {
  final AuthService _authService = AuthService();
  final String email;
  final TextEditingController codeController = TextEditingController();

  VerifyScreen({super.key, required this.email});

  void _verify(BuildContext context) async {
    final code = codeController.text;
    final success = await _authService.verifyEmail(email, code);
    if (success) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => LoginScreen()),
        (_) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Verify Email')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Enter the verification code sent to your email.'),
            TextField(
              controller: codeController,
              decoration: InputDecoration(labelText: 'Verification Code'),
            ),
            SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => _verify(context),
              child: Text('Verify'),
            ),
          ],
        ),
      ),
    );
  }
}
