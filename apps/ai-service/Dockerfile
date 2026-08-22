FROM python:3.11-slim

# build-essential: insightface KHONG co wheel dung san, phai compile C++
# curl: cho healthcheck | libglib2.0-0: mot so build opencv-headless van doi
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# numpy + cython PHAI cai truoc: setup.py cua insightface `import numpy` ngay dong dau,
# chua co numpy la fail truoc khi kip lam gi.
RUN pip install --no-cache-dir "numpy<2" cython

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn
# insightface keo ve opencv-python (ban day du), de len opencv-python-headless.
# Ban day du can libGL. Dat layer nay SAU pip de khong pha cache 2 layer nang phia tren.
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Nuong model vao image. Layer nay nam TRUOC `COPY . .` nen sua code khong lam
# tai lai - chi package thay doi moi invalidate.
RUN python -c "\
from insightface.app import FaceAnalysis; \
a = FaceAnalysis(name='buffalo_l', root='/app/models', providers=['CPUExecutionProvider']); \
a.prepare(ctx_id=-1, det_size=(640, 640)); \
from fastembed import TextEmbedding; \
TextEmbedding(model_name='sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', cache_dir='/app/models/fastembed'); \
print('models OK')"

COPY . .

RUN chmod +x docker-entrypoint.sh
EXPOSE 5000
ENTRYPOINT ["./docker-entrypoint.sh"]
