import 'package:flutter/material.dart';
import 'package:fynds/services/onboarding/onboarding_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:fynds/navigation/app_navigation.dart';
import 'package:fynds/theme/app_theme.dart';
import 'package:fynds/screens/onboarding/style_choice_screen.dart';

class StyleImageChoiceScreen extends StatefulWidget {
  final List<int> selectedStyleIds;

  const StyleImageChoiceScreen({Key? key, required this.selectedStyleIds})
    : super(key: key);

  @override
  _StyleImageChoiceScreenState createState() => _StyleImageChoiceScreenState();
}

class _StyleImageChoiceScreenState extends State<StyleImageChoiceScreen> {
  final OnboardingService _onboardingService = OnboardingService();
  List<OnboardingProduct> _products = [];
  Set<int> _selectedProductIds = {};
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadStyleProducts();
  }

  /// Loads products using the new base64 image method
  Future<void> _loadStyleProducts() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final products = await _onboardingService.getStyleProducts(
        selectedStyleIds: widget.selectedStyleIds,
        limit: 25,
      );

      setState(() {
        _products = products;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load products: $e';
        _isLoading = false;
      });
    }
  }

  void _toggleSelection(int productId) {
    setState(() {
      if (_selectedProductIds.contains(productId)) {
        _selectedProductIds.remove(productId);
      } else {
        _selectedProductIds.add(productId);
      }
    });
  }

  Future<void> _saveSelections() async {
    setState(() => _isLoading = true);

    try {
      await _onboardingService.saveOnboardingSelections(
        _selectedProductIds.toList(),
      );

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('onboardingComplete', true);

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const AppNavigation()),
      );
    } catch (e) {
      print('Error saving selections: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _skipSelection() {
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const AppNavigation()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: Column(
        children: [
          // Top pink section - smaller to match other screens
          Container(
            width: double.infinity,
            height: 120,
            decoration: const BoxDecoration(color: AppTheme.primaryColor),
            child: const SafeArea(
              child: SizedBox(), // Empty pink section
            ),
          ),

          // Bottom white section with content
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: const BoxDecoration(color: AppTheme.backgroundColor),
              padding: const EdgeInsets.symmetric(
                horizontal: 24,
                vertical: 16,
              ), // Reduced padding
              child: SafeArea(
                top: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Header with back arrow and step indicator
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: const Icon(
                            Icons.arrow_back,
                            color: AppTheme.textPrimary,
                            size: 24,
                          ),
                          onPressed: () {
                            // Navigate back to StyleChoiceScreen
                            Navigator.pop(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const StyleChoiceScreen(),
                              ),
                            );
                          },
                          padding: EdgeInsets.zero,
                        ),
                        const Text(
                          'Step 3/3',
                          style: TextStyle(
                            color: AppTheme.textSecondary,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10), // Reduced spacing
                    // Title
                    const Text(
                      'Choose your look',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),

                    const SizedBox(height: 4), // Reduced spacing
                    // Subtitle
                    const Text(
                      'Select as many as you like!',
                      style: TextStyle(
                        fontSize: 16,
                        color: AppTheme.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),

                    const SizedBox(height: 20), // Reduced spacing
                    // Content area - EXPANDED to take more space
                    Expanded(
                      flex: 6, // Give more space to the grid
                      child:
                          _isLoading
                              ? const Center(
                                child: CircularProgressIndicator(
                                  color: AppTheme.primaryColor,
                                  strokeWidth: 2,
                                ),
                              )
                              : _error != null
                              ? Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      _error!,
                                      style: const TextStyle(color: Colors.red),
                                      textAlign: TextAlign.center,
                                    ),
                                    const SizedBox(height: 16),
                                    ElevatedButton(
                                      onPressed: _loadStyleProducts,
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: AppTheme.primaryColor,
                                      ),
                                      child: const Text(
                                        'Retry',
                                        style: TextStyle(color: Colors.white),
                                      ),
                                    ),
                                  ],
                                ),
                              )
                              : GridView.builder(
                                padding: EdgeInsets.zero,
                                gridDelegate:
                                    const SliverGridDelegateWithFixedCrossAxisCount(
                                      crossAxisCount: 3,
                                      crossAxisSpacing:
                                          6, // Reduced from 12 to 6
                                      mainAxisSpacing:
                                          6, // Reduced from 12 to 6
                                      childAspectRatio:
                                          0.85, // Slightly taller for more rectangular look
                                    ),
                                itemCount: _products.length,
                                itemBuilder: (context, index) {
                                  final product = _products[index];
                                  final isSelected = _selectedProductIds
                                      .contains(product.id);

                                  return GestureDetector(
                                    onTap: () => _toggleSelection(product.id),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(
                                          4,
                                        ), // Reduced from 8 to 4 for less curve
                                        border: Border.all(
                                          color:
                                              isSelected
                                                  ? AppTheme.primaryColor
                                                  : AppTheme.dividerColor,
                                          width:
                                              isSelected
                                                  ? 1.5
                                                  : 0.5, // Thinner border: 1.5 when selected, 0.5 when not
                                        ),
                                      ),
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(
                                          4,
                                        ), // Reduced from 8 to 4 for less curve
                                        child: product.imageWidget(
                                          width: double.infinity,
                                          height: double.infinity,
                                        ),
                                      ),
                                      // Removed the entire Stack and red tick indicator
                                    ),
                                  );
                                },
                              ),
                    ),

                    const SizedBox(height: 20), // Spacing before buttons
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
                              onPressed: _isLoading ? null : _saveSelections,
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
