import 'package:flutter/material.dart';
import 'package:fynds/services/onboarding/onboarding_service.dart';
import 'package:fynds/models/style.dart';
import 'package:fynds/screens/onboarding/style_image_choice_screen.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class StyleChoiceScreen extends StatefulWidget {
  const StyleChoiceScreen({super.key});

  @override
  State<StyleChoiceScreen> createState() => _StyleChoiceScreenState();
}

class _StyleChoiceScreenState extends State<StyleChoiceScreen> {
  final OnboardingService _onboardingService = OnboardingService();

  List<Style>? _styles;
  final Set<int> _selectedStyles = {};
  bool _isLoading = false;

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

    setState(() => _isLoading = true);
    try {
      // this will throw on failure
      await _onboardingService.assignStylesToUser(_selectedStyles.toList());

      // retrieve clothing preference
      final prefs = await SharedPreferences.getInstance();
      final clothingPref = prefs.getString('clothing_preference') ?? 'both';

      // navigate to image choice
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder:
              (_) => StyleImageChoiceScreen(
                selectedStyleIds: _selectedStyles.toList(),
              ),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Submission failed: $e")));
    } finally {
      setState(() => _isLoading = false);
    }
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
                        /* skip */
                      },
                      child: const Text('Skip'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _submitDetails,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                      ),
                      child:
                          _isLoading
                              ? const SizedBox(
                                height: 16,
                                width: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                              : const Text(
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
