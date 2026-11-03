-- AlterTable
ALTER TABLE "books" ADD COLUMN     "publisher_id" INTEGER;

-- CreateTable
CREATE TABLE "publishers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "founded_year" INTEGER,

    CONSTRAINT "publishers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_publisher_id_fkey" FOREIGN KEY ("publisher_id") REFERENCES "publishers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

