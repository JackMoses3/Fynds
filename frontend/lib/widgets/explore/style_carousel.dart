import 'package:flutter/material.dart';
import 'package:fynds/screens/explore/style_screen.dart';
import '../../models/style.dart';
import '../../services/explore/style_service.dart';
import '../../services/onboarding/onboarding_service.dart';
import './style_widget.dart';

class StyleCarousel extends StatefulWidget {
  final String title;
  final List<Style>? initialStyles;
  final bool showTitle;
  final String? sex;

  const StyleCarousel({
    Key? key,
    this.title = 'EXPLORE STYLES',
    this.initialStyles,
    this.showTitle = true,
    this.sex,
  }) : super(key: key);

  @override
  _StyleCarouselState createState() => _StyleCarouselState();
}

class _StyleCarouselState extends State<StyleCarousel> {
  final StyleService _styleService = StyleService();
  final OnboardingService _onboardingService = OnboardingService();
  List<Style> _styles = [];
  bool _isLoading = true;
  String? _error;
  late Future<String?> _genderFuture;

  @override
  void initState() {
    super.initState();
    _genderFuture = _onboardingService.getClothingPreference();

    if (widget.initialStyles != null) {
      _styles = widget.initialStyles!;
      _isLoading = false;
    } else {
      _loadStyles();
    }
  }

  Future<void> _loadStyles() async {
    try {
      setState(() {
        _isLoading = true;
        _error = null;
      });

      final styles = await _styleService.getStyles();

      setState(() {
        _styles = styles ?? [];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
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
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
                letterSpacing: 0.5,
              ),
            ),
          ),

        // Styles Carousel
        SizedBox(height: 180, child: _buildCarouselContent()),
      ],
    );
  }

  Widget _buildCarouselContent() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.black87),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, color: Colors.grey[600], size: 32),
            const SizedBox(height: 8),
            Text(
              'Failed to load styles',
              style: TextStyle(color: Colors.grey[600], fontSize: 14),
            ),
            const SizedBox(height: 8),
            TextButton(onPressed: _loadStyles, child: const Text('Retry')),
          ],
        ),
      );
    }

    if (_styles.isEmpty) {
      return Center(
        child: Text(
          'No styles available',
          style: TextStyle(color: Colors.grey[600], fontSize: 14),
        ),
      );
    }

    return FutureBuilder<String?>(
      future: _genderFuture,
      builder: (context, snapshot) {
        final userGender = snapshot.data ?? 'female'; // Default fallback

        return ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: _styles.length,
          itemBuilder: (context, index) {
            final style = _styles[index];
            return Padding(
              padding: EdgeInsets.only(
                right: index < _styles.length - 1 ? 16 : 0,
              ),
              child: StyleWidget(
                style: style,
                imageUrl: _getStyleImageUrl(style, userGender),
                onTap: () => _navigateToStyleCatalogue(style),
              ),
            );
          },
        );
      },
    );
  }

  String _getStyleImageUrl(Style style, String userGender) {
    if (userGender == "male" && style.imageUrlMale != null) {
      return style.imageUrlMale!;
    }
    return style.imageUrlFemale ?? '';
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
