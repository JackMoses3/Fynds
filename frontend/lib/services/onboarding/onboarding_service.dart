import 'package:dio/dio.dart';
import 'package:fynds/core/dio_client.dart';
import 'package:fynds/models/style.dart';

class OnboardingService {
  final Dio _dio = DioClient().client;

  Future<bool> additionalUserInformation({
    required String clothingPreferences,
    required DateTime birthDate,
    required String location,
  }) async {
    try {
      final response = await _dio.post(
        'user/onboarding/additional-info',
        data: {
          'clothingPreferences': clothingPreferences,
          'birthDate': birthDate.toIso8601String(),
          'location': location,
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Error sending onboarding info: $e');
      return false;
    }
  }

  Future<List<Style>?> getStyles() async {
    try {
      final response = await _dio.get('style');
      final List data = response.data;
      return data.map((json) => Style.fromJson(json)).toList();
    } catch (e) {
      print('Error fetching styles: $e');
      return null;
    }
  }

  Future<bool> assignStylesToUser(List<int> styleIds) async {
    try {
      final response = await _dio.post(
        'user/assign-styles',
        data: {'styleIds': styleIds},
      );

      return response.statusCode == 200;
    } catch (e) {
      print('Error assigning styles to user: $e');
      return false;
    }
  }
}
