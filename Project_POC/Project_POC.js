/*
 * Project POC Widget - Controller
 * Follows 3DEXPERIENCE AMD best practices.
 */

requirejs.config({
    paths: {
        'Tabulator': 'JazzySole/Tabulator/js/tabulator.min',
        'purecss': 'JazzySole/PureCss/pure-min',
        'DS/PlatformServices/PlatformServices': 'JazzySole/PlatformService/PlatformServices',
        'TabularCss': 'JazzySole/Tabulator/css/tabulator.min'
    }
});

define('Project_POC/Project_POC', [
    'UWA/Core',
    'UWA/Class',
    'DS/WAFData/WAFData',
    'DS/PlatformServices/PlatformServices',
    'Tabulator',
    'css!Project_POC/Project_POC',
    'css!purecss',
    'css!TabularCss'
], function (UWA, UWAClass, WAFData, PlatformServices, Tabulator) {
    'use strict';

    var Project_POC = {
        table: null,

        onLoad: function () {
            console.log('[Project_POC] onLoad started');
            
            this.container = widget.getElement('#project-poc-container');
            if (!this.container) {
                console.error('[Project_POC] Root container not found!');
                return;
            }

            var that = this;
            PlatformServices.initializeAll().then(function() {
                console.log('[Project_POC] PlatformServices initialized.');
                that.renderLandingPage();
                console.log('[Project_POC] Widget initialized successfully');
            }).catch(function(err) {
                console.error('[Project_POC] PlatformServices initialization failed:', err);
                that.container.innerHTML = '<div class="alert alert-danger m-3">Failed to initialize Platform Services. Check console for details.</div>';
            });
        },

        onRefresh: function() {
            console.log('[Project_POC] Widget refreshed');
            this.renderLandingPage();
        },

        renderLandingPage: function () {
            this.container.innerHTML = '';

            // Header Section
            var headerRow = UWA.createElement('div', { 'class': 'row mb-3 align-items-center' });
            var titleCol = UWA.createElement('div', { 'class': 'col-md-8' });
            UWA.createElement('h2', { 'text': 'Projects Landing Page', 'class': 'm-0' }).inject(titleCol);
            
            var actionCol = UWA.createElement('div', { 'class': 'col-md-4 text-end' });
            var createBtn = UWA.createElement('button', {
                'class': 'btn btn-primary pure-button pure-button-primary',
                'text': '+ Create Project'
            });
            var that = this;
            createBtn.addEvent('click', function() {
                console.log("Create Project Clicked");
                that.openCreateProjectModal();
            });
            createBtn.inject(actionCol);
            
            titleCol.inject(headerRow);
            actionCol.inject(headerRow);
            headerRow.inject(this.container);

            // Table Container
            var tableContainer = UWA.createElement('div', {
                'id': 'project-tabulator-table',
                'class': 'border rounded shadow-sm'
            });
            tableContainer.inject(this.container);

            // Initialize Tabulator
            this.initTable();
        },

        initTable: function() {
            var that = this;
            this.table = new Tabulator("#project-tabulator-table", {
                data: [], // Starts empty, will be populated by API
                layout: "fitColumns",
                responsiveLayout: "collapse",
                pagination: "local",
                paginationSize: 10,
                placeholder: "Loading projects...",
                columns: [
                    { title: "ID", field: "name", width: 100 },
                    { title: "Title", field: "title", headerFilter: "input" },
                    { title: "State", field: "state", headerFilter: "input", width: 120 },
                    { title: "Owner", field: "owner", headerFilter: "input" },
                    { title: "Est. Finish Date", field: "date", width: 140 },
                    { title: "Progress", field: "percentComplete", formatter: "progress", width: 120 },
                    { 
                        title: "Actions", 
                        formatter: function(cell, formatterParams, onRendered) {
                            return "<button class='btn btn-sm btn-outline-primary py-0 px-2'>View</button>";
                        },
                        width: 90,
                        headerSort: false,
                        cellClick: function(e, cell) {
                            alert("View Details for " + cell.getRow().getData().name);
                        }
                    }
                ]
            });

            this.loadProjects();
        },

        loadProjects: function() {
            var that = this;
            var global = PlatformServices.getGlobalVariable();
            if (!global || !global.SecurityContext) {
                console.error('[Project_POC] Missing security context');
                return;
            }

            var endpoint = '/resources/v1/modeler/projects?tenant=' + global.tenant + 
                '&$simpleJSON=true&$type=Project&state=Create,Assign,Active,Review,Complete' +
                '&$fields=none,custom,name,title,typeicon,image,modifyAccess,kindofBaseline,kindofExperiment,bookmarkRootId,title,type,nlsType,state,owner,ownerInfo.name,ownerInfo.firstname,ownerInfo.lastname,estimatedFinishDate,percentComplete,programList.typeicon,programList.name,programList.title,description' +
                '&$include=none,ownerInfo,programList&level=1&excludeSubtypes=Experiment';
                
            var apiUrl = global.computeUrl(endpoint);
            console.log('[Project_POC] Fetching projects from:', apiUrl);

            WAFData.authenticatedRequest(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'SecurityContext': global.SecurityContext
                },
                type: 'json',
                onComplete: function(response) {
                    console.log('[Project_POC] Projects fetched successfully:', response);
                    
                    var tableData = [];
                    if (response && response.data) {
                        var projects = response.data;
                        for (var i = 0; i < projects.length; i++) {
                            var proj = projects[i];
                            var ownerName = proj.owner || '';
                            if (proj.ownerInfo) {
                                // Sometimes returned as array, sometimes object
                                var info = Array.isArray(proj.ownerInfo) ? proj.ownerInfo[0] : proj.ownerInfo;
                                if (info) {
                                    ownerName = (info.firstname || '') + ' ' + (info.lastname || '') || info.name || ownerName;
                                }
                            }
                            
                            tableData.push({
                                id: proj.id,
                                name: proj.name, // 3DX physical ID or Name
                                title: proj.title || proj.description || '',
                                state: proj.state || '',
                                owner: ownerName.trim(),
                                date: proj.estimatedFinishDate || '',
                                percentComplete: proj.percentComplete || 0
                            });
                        }
                    }
                    that.table.setData(tableData);
                },
                onFailure: function(error) {
                    console.error('[Project_POC] Failed to fetch projects:', error);
                    that.table.setData([]);
                    alert('Error loading projects. See console for details.');
                },
                onTimeout: function() {
                    console.error('[Project_POC] Request timed out while fetching projects');
                    that.table.setData([]);
                    alert('Request timed out while fetching projects.');
                }
            });
        },

        openCreateProjectModal: function() {
            var that = this;
            var modalId = 'create-project-modal';

            // Check if existing
            var existingModal = document.getElementById(modalId);
            if (existingModal) {
                existingModal.remove();
            }

            // Modal Overlay
            var modalOverlay = UWA.createElement('div', {
                'id': modalId,
                'class': 'modal-overlay',
                'styles': {
                    'position': 'fixed', 'top': '0', 'left': '0', 'width': '100%', 'height': '100%',
                    'background': 'rgba(0,0,0,0.5)', 'z-index': '1000', 'display': 'flex',
                    'justify-content': 'center', 'align-items': 'center'
                }
            });

            // Modal Content Container
            var modalContent = UWA.createElement('div', {
                'class': 'modal-content bg-white rounded p-4 shadow-lg w-50',
                'styles': { 'max-width': '600px', 'max-height': '90vh', 'overflow-y': 'auto' }
            });

            // Modal Header
            var header = UWA.createElement('div', { 'class': 'd-flex justify-content-between mb-3 border-bottom pb-2' });
            UWA.createElement('h4', { 'class': 'm-0', 'text': 'Create New Project' }).inject(header);
            var closeBtn = UWA.createElement('button', { 'class': 'btn-close border-0 bg-transparent fs-4 text-muted', 'html': '&times;' });
            closeBtn.addEvent('click', function() { modalOverlay.destroy(); });
            closeBtn.inject(header);
            header.inject(modalContent);

            // Form Body
            var formBody = UWA.createElement('div', { 'class': 'mb-3' });

            // Title Field
            var titleGroup = UWA.createElement('div', { 'class': 'mb-3' });
            UWA.createElement('label', { 'class': 'form-label', 'text': 'Project Title *' }).inject(titleGroup);
            var inputTitle = UWA.createElement('input', { 'type': 'text', 'class': 'form-control', 'id': 'proj-title', 'placeholder': 'e.g., Next Gen Implementation' });
            inputTitle.inject(titleGroup);
            titleGroup.inject(formBody);

            // Description Field
            var descGroup = UWA.createElement('div', { 'class': 'mb-3' });
            UWA.createElement('label', { 'class': 'form-label', 'text': 'Description *' }).inject(descGroup);
            var inputDesc = UWA.createElement('textarea', { 'class': 'form-control', 'id': 'proj-desc', 'rows': '3', 'placeholder': 'Project objective and description...' });
            inputDesc.inject(descGroup);
            descGroup.inject(formBody);

            // Visibility field removed — projectVisibility has a server-restricted range on this platform
            
            formBody.inject(modalContent);

            // Modal Footer (Buttons)
            var footer = UWA.createElement('div', { 'class': 'text-end pt-3 border-top' });
            var cancelBtn = UWA.createElement('button', { 'class': 'btn btn-secondary me-2', 'text': 'Cancel' });
            cancelBtn.addEvent('click', function() { modalOverlay.destroy(); });
            cancelBtn.inject(footer);

            var submitBtn = UWA.createElement('button', { 'class': 'btn btn-primary', 'text': 'Save Project' });
            submitBtn.addEvent('click', function() {
                var title = inputTitle.value.trim();
                var desc = inputDesc.value.trim();

                if (!title || !desc) {
                    alert('Please fill in all required fields.');
                    return;
                }

                // Show basic loading indication
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
                
                that.callCreateProjectAPI(title, desc, function(success, response) {
                    if (success) {
                        alert('Project created successfully!');
                        modalOverlay.destroy();
                        that.loadProjects(); // Refetch table data here
                    } else {
                        alert('Failed to create project: ' + response);
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Save Project';
                    }
                });
            });
            submitBtn.inject(footer);
            
            footer.inject(modalContent);
            modalContent.inject(modalOverlay);
            modalOverlay.inject(document.body);
        },

        callCreateProjectAPI: function(title, description, callback) {
            var global = PlatformServices.getGlobalVariable();
            if (!global || !global.SecurityContext) {
                console.error('[Project_POC] Missing security context');
                callback(false, 'Missing security context');
                return;
            }

            if (!global.CSRFToken) {
                console.error('[Project_POC] Missing CSRF token');
                callback(false, 'Missing CSRF token');
                return;
            }

            // Generate a simple tempId (UUID-like)
            var tempId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });

            var now = new Date().toISOString();
            var tenant = global.tenant || 'OnPremise';

            var endpoint = '/resources/v1/modeler/projects?tenant=' + tenant + '&$simpleJSON=true';
            var apiUrl = global.computeUrl(endpoint);
            console.log('[Project_POC] Creating project at:', apiUrl);

            // Payload structure matches the working API example exactly (flat, not dataelements-wrapped)
            // NOTE: projectVisibility is NOT sent — the platform has a restricted range and will 400 on invalid values
            var payload = {
                data: [
                    {
                        tempId: tempId,
                        serviceId: '3DSpace',
                        updateAction: 'CREATE',
                        projectType: 'Project Space',
                        policy: 'Project Space',
                        constraintDate: now,
                        scheduleFrom: 'Project Start Date',
                        defaultConstraintType: 'As Soon As Possible',
                        title: title,
                        description: description,
                        name: "P-40658320-XXXXX",
                        identifier: "XXXXX-XX",
                    }
                ],
                csrf: {
                    name: 'ENO_CSRF_TOKEN',
                    value: global.CSRFToken
                }
            };

            WAFData.authenticatedRequest(apiUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'SecurityContext': global.SecurityContext,
                    'ENO_CSRF_TOKEN': global.CSRFToken
                },
                data: JSON.stringify(payload),
                type: 'json',
                onComplete: function(response) {
                    console.log('[Project_POC] Project created successfully:', response);
                    callback(true, response);
                },
                onFailure: function(error, responseText) {
                    console.error('[Project_POC] Failed to create project:', error, responseText);
                    var msg = error;
                    try {
                        var errObj = JSON.parse(responseText);
                        if (errObj && errObj.error) { msg = errObj.error; }
                    } catch (e) {}
                    callback(false, msg);
                },
                onTimeout: function() {
                    console.error('[Project_POC] Request timed out while creating project');
                    callback(false, 'timeout');
                }
            });
        }
    };

    return Project_POC;
});
