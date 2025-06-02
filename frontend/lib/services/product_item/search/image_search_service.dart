// lib/services/embedding/image_embedding_service.dart
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:frontend/core/dio_client.dart';

class ImageEmbedResponse {
  final List<double> embedding;
  final String label; // "front" | "back"

  ImageEmbedResponse({required this.embedding, required this.label});

  factory ImageEmbedResponse.fromJson(Map<String, dynamic> json) {
    final rawList = (json['embedding'] as List<dynamic>)
        .map((e) => (e as num).toDouble())
        .toList(growable: false);
    return ImageEmbedResponse(
      embedding: rawList,
      label: json['label'] as String,
    );
  }
}

class ImageEmbeddingService {
  final Dio _dio = DioClient().client;

  /// POST /api/embedding/generate-image-embedding
  Future<ImageEmbedResponse?> embedImage(File image) async {
    final fileName = image.path.split('/').last;
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(image.path, filename: fileName),
    });

    final resp = await _dio.post(
      '/embedding/generate-image-embedding',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );

    final status = resp.statusCode ?? 0;
    if (status >= 200 && status < 300) {
      return ImageEmbedResponse.fromJson(resp.data as Map<String, dynamic>);
    } else {
      throw Exception('Unexpected status [$status]: ${resp.data}');
    }
  }
}
