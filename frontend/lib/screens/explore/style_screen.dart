import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:fynds/services/explore/style_service.dart';
import '../../models/product_item/product_item.dart';
import '../../models/style.dart';
import '../../widgets/product_item/staggered_catalogue_view.dart';

class StyleScreen extends StatefulWidget {
  final int styleId;
  final String styleName;
  final Style? style;

  const StyleScreen({
    Key? key,
    required this.styleId,
    required this.styleName,
    this.style,
  }) : super(key: key);

  @override
  _StyleScreenState createState() => _StyleScreenState();
}

class _StyleScreenState extends State<StyleScreen> {
  final StyleService _styleService = StyleService();
  List<ProductItem> _products = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMoreProducts = true;
  String? _error;
  final ScrollController _scrollController = ScrollController();

  int _currentPage = 0;
  static const int _pageSize = 50;

  @override
  void initState() {
    super.initState();
    _loadProducts();
    _setupScrollListener();
  }

  void _setupScrollListener() {
    _scrollController.addListener(() {
      // Load more when user reaches 80% of scroll
      if (_scrollController.position.pixels >=
              _scrollController.position.maxScrollExtent * 0.8 &&
          !_isLoadingMore &&
          _hasMoreProducts) {
        _loadMoreProducts();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadProducts() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
        _currentPage = 0;
      });

      final products = await _styleService.getProductsByStyle(
        styleId: widget.styleId,
        page: 0,
        limit: _pageSize,
      );

      setState(() {
        _products = products;
        _isLoading = false;
        _hasMoreProducts = products.length == _pageSize;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _loadMoreProducts() async {
    if (_isLoadingMore || !_hasMoreProducts) return;

    try {
      setState(() {
        _isLoadingMore = true;
      });

      _currentPage++;
      final newProducts = await _styleService.getProductsByStyle(
        styleId: widget.styleId,
        page: _currentPage,
        limit: _pageSize,
      );

      setState(() {
        _products.addAll(newProducts);
        _isLoadingMore = false;
        _hasMoreProducts = newProducts.length == _pageSize;
      });
    } catch (e) {
      setState(() {
        _isLoadingMore = false;
        _currentPage--; // Revert page increment on error
      });

      // Show error snackbar
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load more products: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _onRefresh() async {
    HapticFeedback.lightImpact();
    await _loadProducts();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // Header with back button and style name
            _buildHeader(),

            // Content
            Expanded(child: _buildBody()),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Colors.black87, strokeWidth: 2),
            SizedBox(height: 16),
            Text(
              'Loading products...',
              style: TextStyle(color: Colors.grey, fontSize: 14),
            ),
          ],
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, color: Colors.grey[500], size: 64),
              const SizedBox(height: 16),
              Text(
                'Something went wrong',
                style: TextStyle(
                  color: Colors.grey[700],
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Failed to load products',
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _loadProducts,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.black87,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text('Try Again'),
              ),
            ],
          ),
        ),
      );
    }

    if (_products.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.shopping_bag_outlined,
                color: Colors.grey[400],
                size: 64,
              ),
              const SizedBox(height: 16),
              Text(
                'No products found',
                style: TextStyle(
                  color: Colors.grey[700],
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'We couldn\'t find any ${widget.styleName.toLowerCase()} products right now.',
                style: TextStyle(color: Colors.grey[600], fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text(
                  'Explore other styles',
                  style: TextStyle(
                    color: Colors.black87,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _onRefresh,
      color: Colors.black87,
      child: Stack(
        children: [
          StaggeredCatalogueView(items: _products, spacing: 6.0),

          // Loading indicator for pagination
          if (_isLoadingMore)
            Positioned(
              bottom: 16,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black87,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Loading more...',
                        style: TextStyle(color: Colors.white, fontSize: 12),
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

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            spreadRadius: 1,
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          // Back Button
          IconButton(
            onPressed: () {
              HapticFeedback.lightImpact();
              Navigator.of(context).pop();
            },
            icon: const Icon(
              Icons.arrow_back_ios,
              color: Colors.black87,
              size: 22,
            ),
          ),

          // Style Name
          Expanded(
            child: Text(
              widget.styleName,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
                letterSpacing: 0.3,
              ),
              textAlign: TextAlign.center,
            ),
          ),

          // Product count (show when loaded)
          if (!_isLoading && _products.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '${_products.length}${_hasMoreProducts ? '+' : ''}',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                  fontWeight: FontWeight.w500,
                ),
              ),
            )
          else
            const SizedBox(width: 40),
        ],
      ),
    );
  }
}
