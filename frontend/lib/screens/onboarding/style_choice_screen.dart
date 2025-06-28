import 'package:flutter/material.dart';
import 'package:fynds/services/onboarding/onboarding_service.dart';
import 'package:fynds/models/style.dart';
import 'package:fynds/screens/onboarding/style_image_choice_screen.dart';
import 'package:fynds/theme/app_theme.dart';

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
      return; // Silent validation
    }

    setState(() => _isLoading = true);
    try {
      // This will throw on failure
      await _onboardingService.assignStylesToUser(_selectedStyles.toList());

      // Navigate to image choice
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder:
              (_) => StyleImageChoiceScreen(
                selectedStyleIds: _selectedStyles.toList(),
              ),
        ),
      );
    } catch (e) {
      // Handle error silently or show minimal feedback
      print('Error submitting styles: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _skipSelection() {
    // Navigate to next screen without selecting styles
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => StyleImageChoiceScreen(selectedStyleIds: []),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: Column(
        children: [
          // Top pink section - made smaller
          Container(
            width: double.infinity,
            height: 120, // Reduced from 150
            decoration: const BoxDecoration(color: AppTheme.primaryColor),
            child: const SafeArea(
              child: SizedBox(), // Empty pink section
            ),
          ),

          // Bottom white section with style selection
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(color: AppTheme.backgroundColor),
              padding: const EdgeInsets.all(20),
              child: SafeArea(
                top: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Header with back arrow and step indicator separated
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                        const Text(
                          'Step 2/3',
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10), // More space before title
                    // Title - now positioned lower
                    const Text(
                      'Pick your style',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),

                    const SizedBox(height: 4),

                    // Subtitle
                    const Text(
                      'Select as many as you like!',
                      style: TextStyle(
                        fontSize: 16,
                        color: AppTheme.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),

                    const SizedBox(height: 32),

                    // Style chips - made smaller and more compact
                    Expanded(
                      child:
                          _styles == null
                              ? const Center(
                                child: CircularProgressIndicator(
                                  color: AppTheme.primaryColor,
                                  strokeWidth: 2,
                                ),
                              )
                              : SingleChildScrollView(
                                child: Wrap(
                                  spacing: 8, // Reduced from 12
                                  runSpacing: 8, // Reduced from 12
                                  alignment: WrapAlignment.center,
                                  children:
                                      _styles!.map((style) {
                                        final isSelected = _selectedStyles
                                            .contains(style.id);
                                        return GestureDetector(
                                          onTap: () => _toggleStyle(style.id),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12, // Reduced from 16
                                              vertical: 8, // Reduced from 12
                                            ),
                                            decoration: BoxDecoration(
                                              color:
                                                  isSelected
                                                      ? AppTheme.primaryColor
                                                      : Colors.white,
                                              border: Border.all(
                                                color:
                                                    isSelected
                                                        ? AppTheme.primaryColor
                                                        : AppTheme.dividerColor,
                                                width: 1.5,
                                              ),
                                              borderRadius:
                                                  BorderRadius.circular(
                                                    16,
                                                  ), // Reduced from 20
                                            ),
                                            child: Text(
                                              style.name,
                                              style: TextStyle(
                                                fontSize: 12, // Reduced from 14
                                                fontWeight: FontWeight.w500,
                                                color:
                                                    isSelected
                                                        ? Colors.white
                                                        : AppTheme.textPrimary,
                                              ),
                                            ),
                                          ),
                                        );
                                      }).toList(),
                                ),
                              ),
                    ),

                    const SizedBox(height: 16),

                    // Skip and Continue buttons in the same row
                    Row(
                      children: [
                        // Skip button on the left (red)
                        Expanded(
                          flex: 1,
                          child: SizedBox(
                            height: 56,
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _skipSelection,
                              style: ElevatedButton.styleFrom(
                                backgroundColor:
                                    AppTheme.primaryColor, // Red color
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: const Text(
                                'Skip',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(width: 16), // Space between buttons
                        // Continue button on the right (black)
                        Expanded(
                          flex: 2, // Make continue button wider
                          child: SizedBox(
                            height: 56,
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _submitDetails,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.black, // Black color
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
                                        'Continue',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
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
        ],
      ),
    );
  }
}
