var gulp = require('gulp'),
    gutil = require('gulp-util'),
    del = require('del'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    sass = require('gulp-sass'),
    sourceMaps = require('gulp-sourcemaps'),
    imagemin = require('gulp-imagemin'),
    cleanCss = require('gulp-clean-css'),
    browserSync = require('browser-sync').create(),
    autoprefixer = require('gulp-autoprefixer'),
    runSequence = require('run-sequence'),
    assetsRev = require('gulp-rev'),
    cssRev = require('gulp-rev-css-url'),
    plumber = require('gulp-plumber'),
    manifest = require('asset-builder')('app/assets/config.json'),
    assets = require('./assetutils')(manifest),
    replace = require('gulp-replace'),
    mainBowerFiles = require('main-bower-files'),
    autoPrefixBrowserList = ['last 2 version', 'safari 5', 'ie 8', 'ie 9',
        'opera 12.1', 'ios 6', 'android 4'],
    fontExtensions = '*.{ttf,otf,eot,woff,woff2,svg}',
    imagesExtensions = '*.{jpg,jpeg,png,gif}',
    // Manifest name and options for assets revisions
    manifestRevName = 'manifest.json',
    manifestRevOptions = {
        base: '.',
        merge: true
    };

var regexes = {
    // This regex is responsible for "cleaning" the paths for images in CSS
    cssImages: /(url|src)\((['"])?([\.\/\w]+)\/([\w0-9-_]+\.)(gif|png|jpg|jpeg)\2\)/gm,
    cssFonts: /(url|src)\((['"])?([\.\/\w]+)\/([\w0-9-_]+\.)(eot|svg|woff[2]?|ttf|otf)([\?#a-zA-Z0-9_-]+)?\2\)/gm
};

//============================ App's assets tasks ============================//
gulp.task('images-compress', function () {
    return gulp.src(assets.getBuildPath('images') + '**/' + imagesExtensions)
        .pipe(imagemin({
            optimizationLevel: 8,
            progressive: true,
            interlaced: true
        }))
        .pipe(gulp.dest(assets.getBuildPath()));
});

// Copying images
gulp.task('app-images', function () {
    return gulp.src(assets.getSourcePath('images') + '**/' + imagesExtensions)
        .pipe(plumber())
        .pipe(gulp.dest(assets.getDistPath()))
        .pipe(browserSync.stream());
});

// Copying the system fonts
gulp.task('app-fonts', function () {
    return gulp.src([assets.getSourcePath('fonts') + '/**/' + fontExtensions])
        .pipe(gulp.dest(assets.getDistPath('fonts')))
        .pipe(browserSync.stream());
});

// Compiling our JavaScripts
gulp.task('app-scripts', function () {
    return gulp.src(assets.getSourcePath('scripts') + '/**/*.js')
        .pipe(plumber())
        .pipe(concat('app.js'))
        .pipe(gulp.dest(assets.getDistPath('scripts')))
        .pipe(browserSync.stream());
});

// Compiling our SCSS files
gulp.task('app-styles', function () {
    return gulp.src(assets.getSourcePath('styles') + '/main.scss')
        .pipe(plumber({
            errorHandler: function (err) {
                console.log(err);
                this.emit('end');
            }
        }))
        .pipe(sass({
            errLogToConsole: true
        }))
        .pipe(concat('app.css'))
        .pipe(replace(regexes.cssImages, '$1($2../'+ assets.getAssetPath('styles') +'/$4$5$2)'))
        .pipe(replace(regexes.cssFonts, '$1($2../'+ assets.getAssetPath('fonts') +'/$4$5$2)'))
        .pipe(gulp.dest(assets.getDistPath('styles')))
        .pipe(browserSync.stream());
});

//=========================== Plugins' assets tasks ==========================//
gulp.task('plugins-fonts', function () {
    return gulp.src(mainBowerFiles(['/**/' + fontExtensions]))
        .pipe(gulp.dest(assets.getDistPath('fonts')));
});

gulp.task('plugins-scripts', function () {
    return gulp.src(mainBowerFiles(['/**/*.js']))
        .pipe(concat('plugins.js'))
        .pipe(gulp.dest(assets.getDistPath('scripts')));
});

// This task has a "special" feature: It replaces the images paths based on our
// structure.
gulp.task('plugins-styles', function () {
    return gulp.src(mainBowerFiles(['/**/*.css']))
        .pipe(concat('plugins.css'))
        .pipe(replace(regexes.cssImages, '$1($2../' + assets.getAssetPath('images') + '/$4$5$2)'))
        .pipe(replace(regexes.cssFonts, '$1($2../' + assets.getAssetPath('fonts') + '/$4$5$2)'))
        .pipe(gulp.dest(assets.getDistPath('styles')));
});

gulp.task('plugins-images', function () {
    return gulp.src(mainBowerFiles(['/**/' + imagesExtensions]))
        .pipe(gulp.dest(assets.getDistPath('images')));
});

//=========================== General assets tasks ==========================//
gulp.task('scripts-uglify', function () {
    return gulp.src(assets.getDistPath('scripts') + '/*.js')
        .pipe(sourceMaps.init())
        .pipe(uglify())
        .pipe(sourceMaps.write('.'))
        .pipe(gulp.dest(assets.getDistPath('scripts')));
});

gulp.task('styles-uglify', function () {
    return gulp.src(assets.getDistPath('styles') + '/styles/*.css')
        .pipe(plumber())
        .pipe(cleanCss())
        .pipe(gulp.dest(assets.getDistPath('styles')));
});

// Preparing the already compiled CSS files do production
gulp.task('styles-deploy', function () {
    return gulp.src(assets.getDistPath('styles') + '/*.css')
        .pipe(plumber())
        .pipe(autoprefixer({
            browsers: autoPrefixBrowserList,
            cascade: true
        }))
        .pipe(gulp.dest(assets.getDistPath('styles')));
});

//=============================== Utility tasks ==============================//
gulp.task('clean', function () {
    return del([assets.getDistPath()]).then(function (paths) {
        gutil.log(gutil.colors.red('Deleted items: ' + paths.join(',')));
    });
});

gulp.task('browserSync', function () {
    browserSync.init({
        proxy: manifest.config.devUrl,
        options: {
            reloadDelay: 250
        },
        notify: true
    });
});

gulp.task('watch', function () {
    gutil.log(gutil.colors.blue('Starting watch process.'));
    runSequence('clean',
        'app-fonts', 'app-scripts', 'app-styles', 'app-images',
        'plugins-fonts', 'plugins-scripts', 'plugins-styles', 'plugins-images',
        'browserSync'
    );
    gulp.watch(assets.getSourcePath('scripts') + '/**/*.*', ['app-scripts']);
    gulp.watch(assets.getSourcePath('styles') + '/**/*.*', ['app-styles']);
    gulp.watch(assets.getSourcePath('images') + '/**/*.*', ['app-images']);
    gulp.watch('app/templates/**/*.{php,twig,html}', browserSync.reload);
});

// Generating hashes of the resources after all of them are placed on dist
// folder.
gulp.task('hash-assets', function () {
    gutil.log(gutil.colors.blue('Hashing the assets.'));
    var assetsList = ['images', 'scripts', 'styles', 'fonts'],
        globs = [];

    // Generating all the globs we need
    for (resourceIndex in assetsList) {
        globs.push(assets.getDistPath() + assetsList[resourceIndex] + '/**/*.*');
    }

    // Hashing to the build folder
    return gulp.src(globs, {
        base: assets.getDistPath()
    })
        .pipe(assetsRev())
        // Replace assets to hashed versions referenced in CSS files
        .pipe(cssRev())
        .pipe(gulp.dest(assets.getBuildPath()))
        .pipe(assetsRev.manifest(manifestRevName, manifestRevOptions))
        .pipe(gulp.dest(assets.getDistPath()));
});

gulp.task('default', ['watch']);

// Building the assets
gulp.task('build', function () {
    gutil.log(gutil.colors.blue('Starting build process.'));
    runSequence(
        'clean',
        'app-fonts', 'app-scripts', 'app-styles', 'app-images',
        'plugins-fonts', 'plugins-scripts', 'plugins-styles', 'plugins-images',
        'styles-deploy',
        'styles-uglify',
        'scripts-uglify',
        'images-compress',
        'hash-assets'
    );
});
