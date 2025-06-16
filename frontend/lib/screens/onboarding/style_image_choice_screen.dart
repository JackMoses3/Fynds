import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:fynds/services/product_item/onboarding/onboarding_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:fynds/navigation/app_navigation.dart'; // for MainShell/AppNavigation
import '../../models/product_item/product_item.dart';

class StyleImageChoiceScreen extends StatefulWidget {
  final List<int> selectedStyleIds;
  final String clothingPreference;

  const StyleImageChoiceScreen({
    Key? key,
    required this.selectedStyleIds,
    required this.clothingPreference,
  }) : super(key: key);

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

  Future<void> _loadStyleProducts() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final products = await _onboardingService.getStyleProducts(
        selectedStyleIds: widget.selectedStyleIds,
        clothingPreference: widget.clothingPreference,
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

  bool get _canProceed => _selectedProductIds.isNotEmpty;

  Future<void> _saveSelections() async {
    setState(() => _isLoading = true);
    try {
      // save selected products to backend
      await _onboardingService.saveOnboardingSelections(
        _selectedProductIds.toList(),
      );

      // mark onboarding complete
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('onboardingComplete', true);

      // navigate to main shell
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
                    // --- Ultra Minimal Header ---
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

                    // --- 4x4 Scrollable Grid that fits exactly 4 rows ---
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            const int columns = 4;
                            const double spacing = 8;
                            // total available width/height after spacing
                            final double totalW =
                                constraints.maxWidth - (columns - 1) * spacing;
                            final double totalH =
                                constraints.maxHeight - (columns - 1) * spacing;
                            // each tile size
                            final double tileW = totalW / columns;
                            final double tileH =
                                totalH / columns; // 4 rows = same as cols
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

                    // --- Fixed Continue Button ---
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      child: SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: ElevatedButton(
                          // always enabled
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
