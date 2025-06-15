import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:fynds/services/product_item/onboarding/onboarding_service.dart'; // ← make sure this path matches your folder
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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
    // debug: print input
    print(
      '🐞 [StyleImage] loading with styles=${widget.selectedStyleIds} pref=${widget.clothingPreference}',
    );
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });
      final products = await _onboardingService.getStyleProducts(
        selectedStyleIds: widget.selectedStyleIds,
        clothingPreference: widget.clothingPreference,
        limit: 50,
      );
      // debug: print result count
      print('🐞 [StyleImage] got ${products.length} products');
      for (var p in products) {
        print(
          '    • ${p.id} → ${p.images.isNotEmpty ? p.images.first.imageUrl : "(no image)"}',
        );
      }
      setState(() {
        _products = products;
        _isLoading = false;
      });
    } catch (e, st) {
      print('🐞 [StyleImage] error: $e\n$st');
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
    if (!_canProceed) return;

    try {
      setState(() => _isLoading = true);

      await _onboardingService.saveOnboardingSelections(
        _selectedProductIds.toList(),
      );

      Navigator.pushReplacementNamed(context, '/onboarding/complete');
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
      appBar: AppBar(
        title: const Text('Discover Your Style'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      body:
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
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        const Text(
                          'Discover Your Style',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Select items you like',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.grey[600],
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Choose at least 1 item (${_selectedProductIds.length} selected)',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.blue[600],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: GridView.builder(
                      padding: const EdgeInsets.all(16),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio:
                                0.75, // Slightly taller for better product display
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
                              borderRadius: BorderRadius.circular(12),
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
                                  borderRadius: BorderRadius.circular(11),
                                  child:
                                      firstImage != null
                                          ? CachedNetworkImage(
                                            imageUrl: firstImage.imageUrl,
                                            width: double.infinity,
                                            height: double.infinity,
                                            fit: BoxFit.cover,
                                            placeholder:
                                                (context, url) => Container(
                                                  color: Colors.grey[200],
                                                  child: const Center(
                                                    child:
                                                        CircularProgressIndicator(),
                                                  ),
                                                ),
                                            errorWidget:
                                                (context, url, error) =>
                                                    Container(
                                                      color: Colors.grey[200],
                                                      child: const Icon(
                                                        Icons.error,
                                                      ),
                                                    ),
                                          )
                                          : Container(
                                            color: Colors.grey[200],
                                            child: const Icon(
                                              Icons.image_not_supported,
                                            ),
                                          ),
                                ),
                                if (isSelected)
                                  Positioned(
                                    top: 8,
                                    right: 8,
                                    child: Container(
                                      width: 24,
                                      height: 24,
                                      decoration: const BoxDecoration(
                                        color: Colors.blue,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(
                                        Icons.check,
                                        color: Colors.white,
                                        size: 16,
                                      ),
                                    ),
                                  ),
                                Positioned(
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  child: Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      borderRadius: const BorderRadius.only(
                                        bottomLeft: Radius.circular(12),
                                        bottomRight: Radius.circular(12),
                                      ),
                                      gradient: LinearGradient(
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                        colors: [
                                          Colors.transparent,
                                          Colors.black.withOpacity(0.7),
                                        ],
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          product.brand,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        Text(
                                          '\$${product.price.toStringAsFixed(0)}',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _canProceed ? _saveSelections : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor:
                              _canProceed ? Colors.blue : Colors.grey,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: Text(
                          _canProceed
                              ? 'Continue (${_selectedProductIds.length} selected)'
                              : 'Select at least 1 item',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
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
