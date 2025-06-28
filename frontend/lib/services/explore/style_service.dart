import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:fynds/core/dio_client.dart';
import 'package:fynds/models/product_item/product_item.dart';
import 'package:fynds/models/style_with_image.dart';
import '../../models/style.dart';
import '../../models/style_with_image_complete.dart';

class StyleService {
  final Dio _dio = DioClient().client;
  final _storage = FlutterSecureStorage();

  Future<List<Style>?> getStyles() async {
    try {
      final response = await _dio.get('/style');
      if (response.statusCode == 200) {
        return (response.data as List)
            .map((json) => Style.fromJson(json))
            .toList();
      }
      return null;
    } catch (e) {
      print('Error fetching styles: $e');
      throw Exception('Failed to load styles');
    }
  }

  /// Fetch products by style with pagination support
  /// [styleId] - The ID of the style to filter by
  /// [page] - Page number (0-based)
  /// [limit] - Number of products per page (default: 50)
  /// [offset] - Optional offset for pagination (calculated from page if not provided)
  Future<List<ProductItem>> getProductsByStyle({
    required int styleId,
    int page = 0,
    int limit = 50,
    int? offset,
  }) async {
    try {
      final actualOffset = offset ?? (page * limit);

      final response = await _dio.get(
        '/style/$styleId/products',
        data: {'limit': limit, 'offset': actualOffset},
      );

      if (response.statusCode == 200) {
        return (response.data as List)
            .map((json) => ProductItem.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      print('Error fetching products for style $styleId: $e');
      throw Exception('Failed to load products for style');
    }
  }

  /// Fetch products by style name with pagination support
  /// [styleName] - The name of the style to filter by
  /// [page] - Page number (0-based)
  /// [limit] - Number of products per page (default: 50)
  Future<List<ProductItem>> getProductsByStyleName({
    required String styleName,
    int page = 0,
    int limit = 50,
  }) async {
    try {
      final offset = page * limit;

      final response = await _dio.get(
        '/style/name/$styleName/products',
        data: {'limit': limit, 'offset': offset},
      );

      if (response.statusCode == 200) {
        return (response.data as List)
            .map((json) => ProductItem.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      print('Error fetching products for style "$styleName": $e');
      throw Exception('Failed to load products for style');
    }
  }

  /// Get total count of products for a style (useful for pagination UI)
  Future<int> getProductCountByStyle(int styleId) async {
    try {
      final response = await _dio.get('/style/$styleId/products/count');

      if (response.statusCode == 200) {
        return response.data['count'] ?? 0;
      }
      return 0;
    } catch (e) {
      print('Error fetching product count for style $styleId: $e');
      return 0;
    }
  }

  /// Fetch styles with their preview images from local backend storage
  /// [clothingPreference] - "men", "women", or "unisex"
  Future<List<StyleWithImage>> getStylesWithImages() async {
    try {
      // ✅ AWAIT the storage read operation
      final clothingPreference = await _storage.read(key: 'sex') ?? 'unisex';

      print(
        '🎨 [StyleService] Fetching styles with images for: $clothingPreference',
      );

      final response = await _dio.post(
        '/onboarding/style-images',
        data: {
          'clothingPreference': clothingPreference,
        }, // ✅ Now it's a String, not Future<String?>
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data as List<dynamic>;
        print('✅ [StyleService] Received ${data.length} styles with images');

        final stylesWithImages =
            data.map((styleJson) {
              final styleMap = styleJson as Map<String, dynamic>;
              return StyleWithImage.fromJson(styleMap);
            }).toList();

        return stylesWithImages;
      } else {
        print(
          '❌ [StyleService] Unexpected status code: ${response.statusCode}',
        );
        return [];
      }
    } catch (e) {
      print('❌ [StyleService] Error fetching styles with images: $e');
      if (e is DioException) {
        print(
          '🐛 [StyleService] DioException status: ${e.response?.statusCode}',
        );
        print('🐛 [StyleService] DioException data: ${e.response?.data}');
      }
      rethrow;
    }
  }

  /// Combine styles with images and existing style data for complete info
  /// This merges your existing Style model data with the preview images
  Future<List<StyleWithImageComplete>> getCompleteStylesWithImages() async {
    try {
      // Fetch both styles and style images
      final stylesWithImagesFuture = getStylesWithImages();
      final stylesFuture = getStyles();
      final results = await Future.wait([stylesWithImagesFuture, stylesFuture]);
      final stylesWithImages = results[0] as List<StyleWithImage>;
      final styles = results[1] as List<Style>?;

      if (styles == null) {
        print('⚠️ [StyleService] No styles data available');
        return [];
      }

      // Merge the data
      final completeStyles = <StyleWithImageComplete>[];

      for (final styleWithImage in stylesWithImages) {
        final matchingStyle = styles.firstWhere(
          (style) => style.id == styleWithImage.styleId,
          orElse:
              () => Style(
                id: styleWithImage.styleId,
                name: 'Style ${styleWithImage.styleId}',
                description: '',
                imageUrlFemale: null,
                imageUrlMale: null,
              ),
        );

        completeStyles.add(
          StyleWithImageComplete(
            style: matchingStyle,
            previewImage: styleWithImage,
          ),
        );
      }

      print(
        '✅ [StyleService] Created ${completeStyles.length} complete styles',
      );
      return completeStyles;
    } catch (e) {
      print('❌ [StyleService] Error in getCompleteStylesWithImages: $e');
      rethrow;
    }
  }
}
