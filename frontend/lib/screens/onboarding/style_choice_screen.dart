import 'package:flutter/material.dart';
import 'package:fynds/services/onboarding/onboarding_service.dart';
import 'package:fynds/models/style.dart';
import 'package:fynds/widgets/main_shell.dart';
import 'package:shared_preferences/shared_preferences.dart';

class StyleChoiceScreen extends StatefulWidget {
  const StyleChoiceScreen({super.key});

  @override
  State<StyleChoiceScreen> createState() => _StyleChoiceScreenState();
}

class _StyleChoiceScreenState extends State<StyleChoiceScreen> {
  final OnboardingService _onboardingService = OnboardingService();

  List<Style>? _styles;

  @override
  void initState() {
    super.initState();
    _loadStyles();
  }

  Future<void> _loadStyles() async {
    final styles = await _onboardingService.getStyles();
    setState(() {
      _styles = styles;
    });
  }

  final Set<int> _selectedStyles = {};

  void _toggleStyle(int styleId) {
    setState(() {
      if (_selectedStyles.contains(styleId)) {
        _selectedStyles.remove(styleId);
      } else {
        _selectedStyles.add(styleId);
      }
    });
  }

  Future<void> _submitDetails() async {
    if (_selectedStyles.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Please select at least one style")),
      );
      return;
    }

    final success = await _onboardingService.assignStylesToUser(
      _selectedStyles.toList(),
    );

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Styles submitted successfully")),
      );
    } else {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Submission failed")));
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboardingComplete', true);
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const MainShell()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Style your Wardrobe',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Select the styles that best match your aesthetic.',
                style: TextStyle(fontSize: 14, color: Colors.black87),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Expanded(
                child: SingleChildScrollView(
                  child:
                      _styles == null
                          ? const Center(child: CircularProgressIndicator())
                          : Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children:
                                _styles!.map((style) {
                                  final isSelected = _selectedStyles.contains(
                                    style.id,
                                  );
                                  return ChoiceChip(
                                    label: Text(style.name),
                                    selected: isSelected,
                                    onSelected: (_) => _toggleStyle(style.id),
                                    selectedColor: Colors.blue,
                                    backgroundColor: Colors.grey.shade200,
                                    labelStyle: TextStyle(
                                      color:
                                          isSelected
                                              ? Colors.white
                                              : Colors.black,
                                    ),
                                  );
                                }).toList(),
                          ),
                ),
              ),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        // Handle skip
                      },
                      child: const Text('Skip'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => {_submitDetails()},
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                      ),
                      child: const Text(
                        'Next',
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
