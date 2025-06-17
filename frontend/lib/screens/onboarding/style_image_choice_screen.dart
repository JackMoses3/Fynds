import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:fynds/services/onboarding/onboarding_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:fynds/navigation/app_navigation.dart';
import '../../models/product_item/product_item.dart';

class StyleImageChoiceScreen extends StatefulWidget {
  final List<int> selectedStyleIds;

  const StyleImageChoiceScreen({Key? key, required this.selectedStyleIds})
    : super(key: key);

  @override
  _StyleImageChoiceScreenState createState() => _StyleImageChoiceScreenState();
}

class _StyleImageChoiceScreenState extends State<StyleImageChoiceScreen> {
  final OnboardingService _onboardingService = OnboardingService();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  List<ProductItem> _products = [];
  Set<int> _selectedProductIds = {};
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadStyleProducts();
  }

  /// Loads product items based on user's selected styles and clothing preferences
  /// Fetches 25 products (12 male + 13 female if "Both", or 25 of single gender)
  /// Service gets user's clothing preference from backend
  Future<void> _loadStyleProducts() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      // Service will fetch clothing preference from backend and load appropriate images
      // Based on preference: Male = men_images folder, Female = women_images folder, Both = mixed
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

  /// Toggles selection state of a product item
  /// Adds to selection set if not selected, removes if already selected
  /// Used for multi-select functionality in the grid
  void _toggleSelection(int productId) {
    setState(() {
      if (_selectedProductIds.contains(productId)) {
        _selectedProductIds.remove(productId);
      } else {
        _selectedProductIds.add(productId);
      }
    });
  }

  /// Checks if user has selected at least one product to enable continue button
  /// Returns true if any products are selected, false otherwise
  bool get _canProceed => true;

  /// Saves user's product selections to backend and completes onboarding
  /// Marks onboarding as complete in SharedPreferences
  /// Navigates to main app navigation after successful save
  Future<void> _saveSelections() async {
    setState(() => _isLoading = true);
    try {
      // Send selected product IDs to backend for user profile
      await _onboardingService.saveOnboardingSelections(
        _selectedProductIds.toList(),
      );

      // Mark onboarding flow as completed locally
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('onboardingComplete', true);

      // Navigate to main app - onboarding is now complete
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const AppNavigation()),
      );
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed to save selections: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child:
            _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadStyleProducts,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
                : Column(
                  children: [
                    // --- Header with back button and instructions ---
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                      child: Row(
                        children: [
                          GestureDetector(
                            onTap: () => Navigator.pop(context),
                            child: const Icon(
                              Icons.arrow_back,
                              size: 24,
                              color: Colors.black,
                            ),
                          ),
                          const Expanded(
                            child: Column(
                              children: [
                                Text(
                                  'Style your Wardrobe',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  'Select the products that best match your aesthetic.',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 24),
                        ],
                      ),
                    ),

                    // --- 4x4 product grid with tap-to-select functionality ---
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            const int columns = 4;
                            const double spacing = 8;
                            // Calculate tile dimensions to fit exactly 4x4 grid
                            final double totalW =
                                constraints.maxWidth - (columns - 1) * spacing;
                            final double totalH =
                                constraints.maxHeight - (columns - 1) * spacing;
                            final double tileW = totalW / columns;
                            final double tileH = totalH / columns;
                            final double ratio = tileW / tileH;

                            return GridView.builder(
                              padding: EdgeInsets.zero,
                              physics: const BouncingScrollPhysics(),
                              gridDelegate:
                                  SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: columns,
                                    crossAxisSpacing: spacing,
                                    mainAxisSpacing: spacing,
                                    childAspectRatio: ratio,
                                  ),
                              itemCount: _products.length,
                              itemBuilder: (context, index) {
                                final product = _products[index];
                                final isSelected = _selectedProductIds.contains(
                                  product.id,
                                );
                                final firstImage =
                                    product.images.isNotEmpty
                                        ? product.images.first
                                        : null;

                                return GestureDetector(
                                  onTap: () => _toggleSelection(product.id),
                                  child: Container(
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(8),
                                      // Blue border when selected, gray when not
                                      border: Border.all(
                                        color:
                                            isSelected
                                                ? Colors.blue
                                                : Colors.grey[300]!,
                                        width: isSelected ? 3 : 1,
                                      ),
                                    ),
                                    child: Stack(
                                      children: [
                                        // Product image with loading/error states
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(
                                            7,
                                          ),
                                          child:
                                              firstImage != null
                                                  ? CachedNetworkImage(
                                                    imageUrl:
                                                        firstImage.imageUrl,
                                                    fit: BoxFit.cover,
                                                    width: double.infinity,
                                                    height: double.infinity,
                                                    placeholder:
                                                        (c, u) => Container(
                                                          color:
                                                              Colors.grey[200],
                                                          child: const Center(
                                                            child:
                                                                CircularProgressIndicator(
                                                                  strokeWidth:
                                                                      2,
                                                                ),
                                                          ),
                                                        ),
                                                    errorWidget:
                                                        (c, u, e) => Container(
                                                          color:
                                                              Colors.grey[200],
                                                          child: const Icon(
                                                            Icons.error,
                                                            size: 20,
                                                          ),
                                                        ),
                                                  )
                                                  : Container(
                                                    color: Colors.grey[200],
                                                    child: const Icon(
                                                      Icons.image_not_supported,
                                                      size: 20,
                                                    ),
                                                  ),
                                        ),
                                        // Blue checkmark overlay when item is selected
                                        if (isSelected)
                                          const Positioned(
                                            top: 4,
                                            right: 4,
                                            child: CircleAvatar(
                                              radius: 8,
                                              backgroundColor: Colors.blue,
                                              child: Icon(
                                                Icons.check,
                                                color: Colors.white,
                                                size: 12,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            );
                          },
                        ),
                      ),
                    ),

                    // --- Continue button (always enabled, completes onboarding) ---
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _saveSelections,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blue,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(6),
                            ),
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
                                    'Continue',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 15,
                                    ),
                                  ),
                        ),
                      ),
                    ),
                  ],
                ),
      ),
    );
  }
}
