import 'package:flutter/material.dart';
import 'package:fynds/screens/explore/style_screen.dart';
import 'package:fynds/models/style_with_image_complete.dart';
import '../../models/style.dart';
import '../../services/explore/style_service.dart';
import '../../services/onboarding/onboarding_service.dart';

class StyleCarousel extends StatefulWidget {
  final String title;
  final List<Style>? initialStyles;
  final bool showTitle;

  const StyleCarousel({
    Key? key,
    this.title = 'EXPLORE STYLES',
    this.initialStyles,
    this.showTitle = true,
  }) : super(key: key);

  @override
  _StyleCarouselState createState() => _StyleCarouselState();
}

class _StyleCarouselState extends State<StyleCarousel> {
  final StyleService _styleService = StyleService();
  final OnboardingService _onboardingService = OnboardingService();
  List<StyleWithImageComplete> _stylesWithImages = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadStylesWithImages();
  }

  Future<void> _loadStylesWithImages() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      // Get user's clothing preference from storage
      final clothingPreference =
          await _onboardingService.getClothingPreference();
      final preference = clothingPreference.toLowerCase();

      print('🎨 [StyleCarousel] Loading styles for preference: $preference');

      // Fetch styles with images from local backend storage
      final stylesWithImages =
          await _styleService.getCompleteStylesWithImages();

      setState(() {
        _stylesWithImages = stylesWithImages;
        _isLoading = false;
      });

      print(
        '✅ [StyleCarousel] Loaded ${stylesWithImages.length} styles with images',
      );
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
      print('❌ [StyleCarousel] Error loading styles: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Title
        if (widget.showTitle)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              widget.title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
                letterSpacing: 0.3,
              ),
            ),
          ),

        // Styles Carousel - Made taller
        SizedBox(
          height: 160, // ✅ Increased from 120 to 140
          child: _buildCarouselContent(),
        ),
      ],
    );
  }

  Widget _buildCarouselContent() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.black87, strokeWidth: 2),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              color: Colors.grey[600],
              size: 24,
            ), // ✅ Smaller icon
            const SizedBox(height: 4),
            Text(
              'Failed to load styles',
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 12,
              ), // ✅ Smaller text
            ),
            const SizedBox(height: 4),
            TextButton(
              onPressed: _loadStylesWithImages,
              child: const Text('Retry', style: TextStyle(fontSize: 12)),
            ),
          ],
        ),
      );
    }

    if (_stylesWithImages.isEmpty) {
      return Center(
        child: Text(
          'No styles available',
          style: TextStyle(
            color: Colors.grey[600],
            fontSize: 12,
          ), // ✅ Smaller text
        ),
      );
    }

    // ✅ Calculate item width to fit ~4 items on screen
    return LayoutBuilder(
      builder: (context, constraints) {
        final screenWidth = constraints.maxWidth;
        final itemWidth =
            (screenWidth - 48) /
            4.2; // 48 = horizontal padding, 4.2 to show partial 5th item

        return ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: _stylesWithImages.length,
          itemBuilder: (context, index) {
            final styleWithImage = _stylesWithImages[index];
            return Padding(
              padding: EdgeInsets.only(
                right:
                    index < _stylesWithImages.length - 1
                        ? 8
                        : 0, // ✅ Reduced spacing
              ),
              child: _buildStyleCard(styleWithImage, itemWidth),
            );
          },
        );
      },
    );
  }

  Widget _buildStyleCard(StyleWithImageComplete styleWithImage, double width) {
    return GestureDetector(
      onTap: () => _navigateToStyleCatalogue(styleWithImage.style),
      child: SizedBox(
        width: width,
        child: Column(
          children: [
            // Style Image - Made taller
            Container(
              height: 115, // ✅ Increased from 85 to 105
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: Colors.grey[50],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: styleWithImage.previewImage.imageWidgetCustom(
                  width: double.infinity,
                  height: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
            ),

            // Style Name - Smaller and constrained
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 6, bottom: 2),
                child: Text(
                  styleWithImage.name,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87,
                    height: 1.2,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _navigateToStyleCatalogue(Style style) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder:
            (context) => StyleScreen(
              styleId: style.id,
              styleName: style.name,
              style: style,
            ),
      ),
    );
  }
}
